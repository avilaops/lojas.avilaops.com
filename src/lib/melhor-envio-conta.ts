import type { Tenant } from "@prisma/client";
import { cifrar, decifrar } from "./cofre";
import { prisma } from "./db";
import { baseDoMelhorEnvio, cabecalhosDoMelhorEnvio } from "./melhor-envio";
import { emitirState as emitirStateAssinado, lerState as lerStateAssinado } from "./oauth-state";

/**
 * Conexão da loja com o Melhor Envio, por OAuth.
 *
 * O aplicativo é da plataforma (`MELHOR_ENVIO_CLIENT_ID` e
 * `MELHOR_ENVIO_CLIENT_SECRET`, cadastrados uma vez no painel deles); a conta
 * é do lojista. Ele autoriza na tela do próprio Melhor Envio e nós guardamos
 * só os tokens, cifrados. Nenhuma senha nem token passa pelas mãos de ninguém.
 *
 * Dois prazos do contrato: o acesso vale 30 dias e o refresh, 45. Loja que
 * ficar mais de 45 dias sem cotar precisa conectar de novo.
 */

/**
 * Só o que a plataforma usa hoje: cotar, e ler de quem é a conta para mostrar
 * na tela. Pedir permissão de compra de etiqueta antes de existir a compra
 * seria o lojista autorizando gasto que ninguém faz.
 */
const ESCOPOS = ["shipping-calculate", "users-read"];

const CAMINHO_DE_RETORNO = "/melhor-envio/callback";

export function aplicativoConfigurado(): boolean {
  return Boolean(process.env.MELHOR_ENVIO_CLIENT_ID && process.env.MELHOR_ENVIO_CLIENT_SECRET);
}

export function conectado(t: Pick<Tenant, "melhorEnvioAccessTokenEnc" | "melhorEnvioRefreshTokenEnc">): boolean {
  return Boolean(t.melhorEnvioAccessTokenEnc && t.melhorEnvioRefreshTokenEnc);
}

// ── state ──────────────────────────────────────────────────────────────

/** O `state` assinado é o mesmo de todas as conexões: ver `oauth-state.ts`. */
const PROPOSITO = "melhor-envio-oauth";

export function emitirState(slug: string): string {
  return emitirStateAssinado(PROPOSITO, slug);
}

export function lerState(state: string | null | undefined): string | null {
  return lerStateAssinado(PROPOSITO, state);
}

// ── OAuth ──────────────────────────────────────────────────────────────

export function urlDeAutorizacao(slug: string, base: string): string {
  const p = new URLSearchParams({
    client_id: process.env.MELHOR_ENVIO_CLIENT_ID ?? "",
    redirect_uri: `${base}${CAMINHO_DE_RETORNO}`,
    response_type: "code",
    state: emitirState(slug),
    scope: ESCOPOS.join(" "),
  });
  return `${baseDoMelhorEnvio()}/oauth/authorize?${p}`;
}

interface RespostaToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  message?: string;
}

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const r = await fetch(`${baseDoMelhorEnvio()}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": cabecalhosDoMelhorEnvio("")["user-agent"],
    },
    body: JSON.stringify({
      client_id: process.env.MELHOR_ENVIO_CLIENT_ID ?? "",
      client_secret: process.env.MELHOR_ENVIO_CLIENT_SECRET ?? "",
      ...corpo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  return (await r.json().catch(() => ({}))) as RespostaToken;
}

const TRINTA_DIAS = 30 * 86_400;

/** Troca o `code` do retorno pelos tokens e grava na loja. */
export async function conectar(slug: string, code: string, base: string) {
  const d = await pedirToken({
    grant_type: "authorization_code",
    redirect_uri: `${base}${CAMINHO_DE_RETORNO}`,
    code,
  });
  if (!d.access_token || !d.refresh_token) {
    throw new Error(d.message ?? d.error ?? "O Melhor Envio não devolveu o token.");
  }

  // De quem é a conta: é o que o lojista vê na tela para saber que conectou a
  // certa. Se a leitura falhar a conexão vale do mesmo jeito.
  const conta = await fetch(`${baseDoMelhorEnvio()}/api/v2/me`, {
    headers: cabecalhosDoMelhorEnvio(d.access_token),
    signal: AbortSignal.timeout(15_000),
  })
    .then((r) => r.json() as Promise<{ firstname?: string; lastname?: string; email?: string }>)
    .catch(() => ({}) as { firstname?: string; lastname?: string; email?: string });
  const nome = [conta.firstname, conta.lastname].filter(Boolean).join(" ").trim();
  const rotulo = [nome, conta.email].filter(Boolean).join(" · ");

  return prisma.tenant.update({
    where: { slug },
    data: {
      melhorEnvioAccessTokenEnc: cifrar(d.access_token),
      melhorEnvioRefreshTokenEnc: cifrar(d.refresh_token),
      melhorEnvioExpiraEm: new Date(Date.now() + (d.expires_in ?? TRINTA_DIAS) * 1000),
      melhorEnvioConectadoEm: new Date(),
      melhorEnvioConta: rotulo || null,
    },
    select: { slug: true, melhorEnvioConta: true },
  });
}

export async function desconectar(tenantId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      melhorEnvioAccessTokenEnc: null,
      melhorEnvioRefreshTokenEnc: null,
      melhorEnvioExpiraEm: null,
      melhorEnvioConectadoEm: null,
      melhorEnvioConta: null,
    },
  });
}

/**
 * Token válido da loja, ou `null` se ela não conectou ou a conexão caiu.
 *
 * Devolve `null` em vez de lançar porque quem chama é o checkout: sem
 * transportadora ele ainda tem a tabela da loja e a retirada para oferecer, e
 * um erro aqui tiraria até isso do comprador.
 *
 * Renova com um dia de folga. A renovação acontece dentro de uma cotação, e
 * um token que vence no meio dela devolveria o checkout sem frete.
 */
export async function tokenDaLoja(t: Tenant): Promise<string | null> {
  if (!t.melhorEnvioAccessTokenEnc || !t.melhorEnvioRefreshTokenEnc) return null;

  try {
    const folga = 86_400_000;
    if (t.melhorEnvioExpiraEm && t.melhorEnvioExpiraEm.getTime() - folga > Date.now()) {
      return decifrar(t.melhorEnvioAccessTokenEnc);
    }
    if (!aplicativoConfigurado()) return null;

    const d = await pedirToken({
      grant_type: "refresh_token",
      refresh_token: decifrar(t.melhorEnvioRefreshTokenEnc),
    });
    if (!d.access_token || !d.refresh_token) {
      console.error(`[frete] Melhor Envio recusou renovar o acesso da loja ${t.slug}:`, d.message ?? d.error ?? "sem motivo");
      return null;
    }

    // O refresh também é trocado a cada renovação: guardar o antigo derruba a
    // próxima, e a cotação some um mês depois sem ninguém ter mexido em nada.
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        melhorEnvioAccessTokenEnc: cifrar(d.access_token),
        melhorEnvioRefreshTokenEnc: cifrar(d.refresh_token),
        melhorEnvioExpiraEm: new Date(Date.now() + (d.expires_in ?? TRINTA_DIAS) * 1000),
      },
    });
    return d.access_token;
  } catch (erro) {
    console.error(`[frete] não consegui o token do Melhor Envio da loja ${t.slug}:`, erro instanceof Error ? erro.message : erro);
    return null;
  }
}
