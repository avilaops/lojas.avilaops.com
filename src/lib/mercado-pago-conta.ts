import type { Tenant } from "@prisma/client";
import { cifrar, decifrar } from "./cofre";
import { prisma } from "./db";
import { emitirState as emitirStateAssinado, lerState as lerStateAssinado } from "./oauth-state";

/**
 * Conexão da loja com o Mercado Pago, por OAuth.
 *
 * O aplicativo é da plataforma (`MP_APP_ID`, `MP_APP_SECRET` e
 * `MP_APP_WEBHOOK_SECRET`, cadastrados uma vez em Suas integrações); a conta é
 * do lojista. Ele autoriza na tela do próprio Mercado Pago e nós guardamos os
 * tokens cifrados. Ninguém copia chave, e ninguém cadastra webhook: a cobrança
 * já sai com a `notification_url` da loja, e quem assina o aviso é o segredo
 * do aplicativo, o mesmo para todas.
 *
 * O dinheiro continua caindo direto na conta do lojista. A autorização não dá
 * à Avila Ops saldo nem saque: dá o que as chaves coladas já davam, cobrar e
 * estornar em nome dele.
 *
 * As chaves coladas à mão continuam valendo para quem já tem. O que diz qual
 * dos dois caminhos a loja usa é `mpRefreshTokenEnc`: só o OAuth preenche.
 */

const API = "https://api.mercadopago.com";
const AUTORIZACAO = "https://auth.mercadopago.com.br/authorization";
const CAMINHO_DE_RETORNO = "/mercado-pago/callback";

/**
 * As três, ou nenhuma. Sem o segredo do webhook a loja conectaria e passaria a
 * confirmar pagamento só na verificação de hora em hora, sem que o lojista
 * tivesse como resolver: o segredo não é dele.
 */
export function aplicativoConfigurado(): boolean {
  return Boolean(process.env.MP_APP_ID && process.env.MP_APP_SECRET && process.env.MP_APP_WEBHOOK_SECRET);
}

export function conectadoPorOAuth(t: Pick<Tenant, "mpAccessTokenEnc" | "mpRefreshTokenEnc">): boolean {
  return Boolean(t.mpAccessTokenEnc && t.mpRefreshTokenEnc);
}

/** O segredo que assina o webhook das lojas conectadas por OAuth. */
export function segredoDoWebhookDoAplicativo(): string | undefined {
  return process.env.MP_APP_WEBHOOK_SECRET || undefined;
}

// ── state ──────────────────────────────────────────────────────────────

/** O `state` assinado é o mesmo de todas as conexões: ver `oauth-state.ts`. */
const PROPOSITO = "mercado-pago-oauth";

export function emitirState(slug: string): string {
  return emitirStateAssinado(PROPOSITO, slug);
}

export function lerState(state: string | null | undefined): string | null {
  return lerStateAssinado(PROPOSITO, state);
}

// ── OAuth ──────────────────────────────────────────────────────────────

export function urlDeAutorizacao(slug: string, base: string): string {
  const p = new URLSearchParams({
    client_id: process.env.MP_APP_ID ?? "",
    response_type: "code",
    platform_id: "mp",
    state: emitirState(slug),
    redirect_uri: `${base}${CAMINHO_DE_RETORNO}`,
  });
  return `${AUTORIZACAO}?${p}`;
}

interface RespostaToken {
  access_token?: string;
  refresh_token?: string;
  public_key?: string;
  user_id?: number | string;
  expires_in?: number;
  live_mode?: boolean;
  error?: string;
  message?: string;
}

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_APP_ID ?? "",
      client_secret: process.env.MP_APP_SECRET ?? "",
      ...corpo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  return (await r.json().catch(() => ({}))) as RespostaToken;
}

const CENTO_E_OITENTA_DIAS = 180 * 86_400;

/** Conta de teste conectada por engano: a loja "venderia" em dinheiro de brinquedo. */
export class ContaDeTeste extends Error {}

/** Troca o `code` do retorno pelos tokens e grava na loja. */
export async function conectar(slug: string, code: string, base: string) {
  const d = await pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${base}${CAMINHO_DE_RETORNO}`,
  });
  // Sem a public key a loja cobraria Pix e boleto e recusaria todo cartão: o
  // formulário de cartão é montado com ela, no navegador.
  if (!d.access_token || !d.refresh_token || !d.public_key) {
    throw new Error(d.message ?? d.error ?? "O Mercado Pago não devolveu as credenciais.");
  }
  if (d.live_mode === false) throw new ContaDeTeste("O Mercado Pago devolveu credenciais de teste.");

  // De quem é a conta: é o que o lojista vê na tela para saber que conectou a
  // certa. Se a leitura falhar a conexão vale do mesmo jeito.
  const conta = await fetch(`${API}/users/me`, {
    headers: { authorization: `Bearer ${d.access_token}` },
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => r.json() as Promise<{ nickname?: string; email?: string }>)
    .catch(() => ({}) as { nickname?: string; email?: string });
  const rotulo = [conta.nickname, conta.email].filter(Boolean).join(" · ");

  return prisma.tenant.update({
    where: { slug },
    data: {
      mpPublicKey: d.public_key,
      mpAccessTokenEnc: cifrar(d.access_token),
      mpRefreshTokenEnc: cifrar(d.refresh_token),
      // O segredo colado à mão era de outra aplicação, a do lojista: os avisos
      // das cobranças novas chegam assinados pela nossa.
      mpWebhookSecretEnc: null,
      mpExpiraEm: new Date(Date.now() + (d.expires_in ?? CENTO_E_OITENTA_DIAS) * 1000),
      mpConectadoEm: new Date(),
      mpUserId: d.user_id != null ? String(d.user_id) : null,
      mpConta: rotulo || null,
    },
    select: { slug: true, mpConta: true },
  });
}

/**
 * Apaga a credencial, e só ela. A loja para de cobrar até conectar de novo; os
 * pedidos já feitos não mudam.
 */
export async function desconectar(tenantId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      mpPublicKey: null,
      mpAccessTokenEnc: null,
      mpRefreshTokenEnc: null,
      mpWebhookSecretEnc: null,
      mpExpiraEm: null,
      mpConectadoEm: null,
      mpUserId: null,
      mpConta: null,
    },
  });
}

// ── renovação ──────────────────────────────────────────────────────────

const FOLGA_MS = 30 * 86_400_000;

/**
 * Renova o acesso das lojas que vencem nos próximos 30 dias.
 *
 * É rotina, e não renovação na hora da cobrança, por dois motivos: o refresh
 * do Mercado Pago é de uso único, e dois compradores fechando pedido no mesmo
 * instante gastariam o mesmo refresh, um deles derrubando a conexão da loja;
 * e quem monta o provedor (`providerDaLoja`) não espera rede. Com 30 dias de
 * folga e uma tentativa por dia, a loja só perde a conexão se a renovação
 * falhar um mês inteiro.
 *
 * Falha de uma loja não segura as outras, mas a rotina termina em erro para
 * aparecer na tela de operação: loja que não renova é loja que vai parar de
 * receber, e o lojista não tem como saber antes.
 */
export async function renovarAcessos(agora = new Date()): Promise<{ renovadas: number }> {
  if (!aplicativoConfigurado()) return { renovadas: 0 };

  const lojas = await prisma.tenant.findMany({
    where: {
      mpRefreshTokenEnc: { not: null },
      OR: [{ mpExpiraEm: null }, { mpExpiraEm: { lt: new Date(agora.getTime() + FOLGA_MS) } }],
    },
    select: { id: true, slug: true, mpRefreshTokenEnc: true },
  });

  let renovadas = 0;
  const falhas: string[] = [];
  for (const loja of lojas) {
    try {
      const d = await pedirToken({ grant_type: "refresh_token", refresh_token: decifrar(loja.mpRefreshTokenEnc!) });
      if (!d.access_token || !d.refresh_token) throw new Error(d.message ?? d.error ?? "sem motivo");
      // O refresh também é trocado a cada renovação: guardar o antigo derruba a
      // próxima, seis meses depois, sem ninguém ter mexido em nada.
      await prisma.tenant.update({
        where: { id: loja.id },
        data: {
          mpAccessTokenEnc: cifrar(d.access_token),
          mpRefreshTokenEnc: cifrar(d.refresh_token),
          ...(d.public_key ? { mpPublicKey: d.public_key } : {}),
          mpExpiraEm: new Date(agora.getTime() + (d.expires_in ?? CENTO_E_OITENTA_DIAS) * 1000),
        },
      });
      renovadas += 1;
    } catch (erro) {
      // Só o slug e o motivo: a resposta do Mercado Pago não carrega token.
      console.error(`[recebimento] Mercado Pago não renovou o acesso da loja ${loja.slug}:`, erro instanceof Error ? erro.message : erro);
      falhas.push(loja.slug);
    }
  }

  if (falhas.length) {
    throw new Error(`Mercado Pago não renovou ${falhas.length} de ${lojas.length}: ${falhas.join(", ")}. Se insistir, a loja precisa conectar de novo.`);
  }
  return { renovadas };
}
