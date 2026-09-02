import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { cifrar, decifrar } from "./cofre";

/**
 * Mercado Livre: conexão da conta e chamada autenticada.
 *
 * **A conta é a mesma do Mercado Pago.** Provado em 02/09/2026: o token do MP
 * responde em `api.mercadolibre.com/users/me` com id, nickname e site_id. O que
 * muda é o escopo, porque o token de pagamento não carrega permissão de venda:
 * `users/<id>/items/search` devolve 403 com ele. Por isso a credencial daqui é
 * separada, ainda que a conta por trás seja a mesma.
 *
 * O token de venda vale 6 horas. Sem `offline_access` no OAuth não vem refresh
 * token, e a integração pararia sozinha toda madrugada.
 */
const API = "https://api.mercadolibre.com";
const SITE = "MLB";

export class MercadoLivreNaoConectado extends Error {}

/** URL para o lojista autorizar. `state` carrega o slug para o callback saber
 *  de quem é a autorização: a rota é uma só para todas as lojas. */
export function urlDeAutorizacao(slug: string, base: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ML_APP_ID ?? "",
    redirect_uri: `${base}/ml/callback`,
    state: slug,
  });
  return `https://auth.mercadolivre.com.br/authorization?${p}`;
}

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  error?: string;
  message?: string;
};

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.ML_APP_ID ?? "",
      client_secret: process.env.ML_APP_SECRET ?? "",
      ...corpo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  return (await r.json().catch(() => ({}))) as RespostaToken;
}

/** Troca o `code` do callback pelo par de tokens e grava na loja. */
export async function conectar(slug: string, code: string, base: string) {
  const d = await pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${base}/ml/callback`,
  });
  if (!d.access_token || !d.refresh_token) {
    throw new Error(d.message ?? d.error ?? "O Mercado Livre não devolveu o token.");
  }

  const conta = await fetch(`${API}/users/me`, {
    headers: { authorization: `Bearer ${d.access_token}` },
    signal: AbortSignal.timeout(15_000),
  })
    .then((r) => r.json() as Promise<{ id?: number; nickname?: string }>)
    .catch(() => ({}) as { id?: number; nickname?: string });

  return prisma.tenant.update({
    where: { slug },
    data: {
      mlUserId: String(d.user_id ?? conta.id ?? ""),
      mlNickname: conta.nickname ?? null,
      mlAccessTokenEnc: cifrar(d.access_token),
      mlRefreshTokenEnc: cifrar(d.refresh_token),
      mlExpiraEm: new Date(Date.now() + (d.expires_in ?? 21_600) * 1000),
      mlConectadoEm: new Date(),
    },
    select: { slug: true, mlNickname: true },
  });
}

/**
 * Token válido da loja, renovando quando falta pouco.
 *
 * A margem de cinco minutos existe porque a sincronização de um catálogo grande
 * leva minutos: sem ela, um token que valia no começo do lote expira no meio e
 * metade dos anúncios falha por 401.
 */
async function tokenValido(t: Tenant): Promise<string> {
  if (!t.mlAccessTokenEnc || !t.mlRefreshTokenEnc) {
    throw new MercadoLivreNaoConectado(`A loja ${t.slug} não conectou o Mercado Livre.`);
  }

  const folga = 5 * 60 * 1000;
  if (t.mlExpiraEm && t.mlExpiraEm.getTime() - folga > Date.now()) {
    return decifrar(t.mlAccessTokenEnc);
  }

  const d = await pedirToken({
    grant_type: "refresh_token",
    refresh_token: decifrar(t.mlRefreshTokenEnc),
  });
  if (!d.access_token || !d.refresh_token) {
    throw new MercadoLivreNaoConectado(
      "O Mercado Livre recusou renovar o acesso. O lojista precisa conectar de novo.",
    );
  }

  // O refresh token também é rotacionado: guardar o antigo derruba a próxima
  // renovação, e a integração morre em seis horas sem ninguém entender por quê.
  await prisma.tenant.update({
    where: { id: t.id },
    data: {
      mlAccessTokenEnc: cifrar(d.access_token),
      mlRefreshTokenEnc: cifrar(d.refresh_token),
      mlExpiraEm: new Date(Date.now() + (d.expires_in ?? 21_600) * 1000),
    },
  });
  return d.access_token;
}

/** Chamada autenticada à API do ML, já com o token renovado. */
export async function chamarMl<T>(t: Tenant, caminho: string, init?: RequestInit): Promise<T> {
  const token = await tokenValido(t);
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const corpo = (await r.json().catch(() => ({}))) as T & { message?: string };
  if (!r.ok) {
    throw new Error(corpo.message ?? `Mercado Livre respondeu ${r.status} em ${caminho}.`);
  }
  return corpo;
}

/**
 * Categoria sugerida para um nome de produto.
 *
 * Público: não exige token, o que permite prever a categoria de um catálogo
 * inteiro antes de o lojista conectar a conta.
 *
 * **O nome decide o resultado, e por isso ele precisa ser enriquecido antes.**
 * Testado em 02/09/2026: "Rolamento 6205 2RS" devolve *Águas Minerais* em
 * primeiro lugar, enquanto "Rolamento rígido de esferas 6205 2RS" devolve
 * *Esferas de rolamento*. Publicar confiando no primeiro palpite colocaria
 * rolamento na seção de água mineral.
 */
export async function preverCategoria(nome: string, limite = 3) {
  const r = await fetch(
    `${API}/sites/${SITE}/domain_discovery/search?limit=${limite}&q=${encodeURIComponent(nome)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!r.ok) return [];
  return (await r.json().catch(() => [])) as Array<{
    domain_id: string;
    domain_name: string;
    category_id: string;
    category_name: string;
  }>;
}

/**
 * Atributos que a categoria exige na publicação.
 *
 * São três exigências distintas, e o diagnóstico precisa das três:
 * `required` impede publicar, `catalog_required` impede casar com o catálogo do
 * ML, e `conditional_required` (GTIN, por exemplo) deixa publicar sem, com
 * regra própria. Filtrar as condicionais aqui esconderia do lojista justamente
 * o campo que faz o anúncio aparecer menos.
 */
export async function atributosDaCategoria(categoriaId: string) {
  const r = await fetch(`${API}/categories/${categoriaId}/attributes`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) return [];
  const todos = (await r.json().catch(() => [])) as Array<{
    id: string;
    name: string;
    tags?: Record<string, boolean>;
    value_type?: string;
  }>;
  return todos.filter((a) => a.tags?.required || a.tags?.catalog_required || a.tags?.conditional_required);
}

export function conectado(t: Tenant): boolean {
  return Boolean(t.mlAccessTokenEnc && t.mlRefreshTokenEnc);
}
