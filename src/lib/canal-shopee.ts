import { createHmac } from "node:crypto";
import { CanalRecusou, lerJson, type ProvedorDeCanal, type TokensRenovados } from "./canal-oauth";

/**
 * Shopee Open Platform (API v2): autorização da loja do lojista.
 *
 * A Shopee chama de autorização um fluxo que não é OAuth2 de livro, e três
 * diferenças custam:
 *
 *   - **toda chamada de API é assinada.** Não existe `client_secret` no corpo:
 *     cada URL leva `partner_id`, `timestamp` e `sign`, um HMAC-SHA256 em hex
 *     feito com a chave do parceiro. A base da assinatura muda conforme a
 *     chamada — ver `assinar`. Só o link de autorização não é assinado;
 *   - **autorização e API moram em endereços diferentes.** O lojista autoriza
 *     em `open.shopee.com.br/auth`; token e loja são chamados no host da API.
 *     O link antigo (`/api/v2/shop/auth_partner`, assinado e sem `state`) a
 *     Shopee hoje documenta só como legado;
 *   - **o `shop_id` acompanha tudo.** Ele vem no retorno e é exigido na troca
 *     do código e em toda renovação. Sem guardar, a conta não renova.
 *
 * Três prazos do contrato: o acesso vale 4 horas; o refresh, 30 dias, de uso
 * único; e a autorização inteira dura o que o lojista escolheu na tela da
 * Shopee, no máximo 365 dias. Passado isso ele precisa conectar de novo.
 */

const AUTORIZACAO = "https://open.shopee.com.br/auth";
const API = "https://partner.shopeemobile.com";
const TRINTA_DIAS = 30 * 86_400;

/** Host das chamadas de API. `SHOPEE_URL` aponta para o ambiente de testes. */
function base(): string {
  return (process.env.SHOPEE_URL || API).replace(/\/+$/, "");
}

/** Página em que o lojista autoriza. `SHOPEE_AUTH_URL` aponta para a de testes. */
function autorizacao(): string {
  return (process.env.SHOPEE_AUTH_URL || AUTORIZACAO).replace(/\/+$/, "");
}

/**
 * Quantos segundos o acesso ainda vale.
 *
 * O guia da Shopee descreve `expire_in` como segundos (14400), mas o exemplo da
 * referência da API traz um valor com cara de data. Se um dia vier a data,
 * tratar como duração guardaria um acesso "válido" por cinquenta anos e a loja
 * pararia de renovar sem erro nenhum.
 */
export function validadeEmSegundos(expireIn: unknown, agoraEmSegundos = Math.floor(Date.now() / 1000)): number {
  const n = typeof expireIn === "number" && Number.isFinite(expireIn) ? expireIn : 4 * 3600;
  const duracao = n > 1_000_000_000 ? n - agoraEmSegundos : n;
  return duracao > 0 ? duracao : 4 * 3600;
}

function parceiro(): { id: string; chave: string } {
  return { id: (process.env.SHOPEE_PARTNER_ID ?? "").trim(), chave: (process.env.SHOPEE_PARTNER_KEY ?? "").trim() };
}

/**
 * A assinatura de uma chamada.
 *
 * A base é `partner_id + caminho + timestamp`, e as chamadas feitas em nome de
 * uma loja acrescentam `access_token + shop_id` no fim. Pedir e renovar token
 * são chamadas do parceiro, e não levam os dois. A hora vale cinco minutos.
 */
export function assinar(caminho: string, timestamp: number, daLoja?: { accessToken: string; shopId: string }): string {
  const { id, chave } = parceiro();
  const texto = `${id}${caminho}${timestamp}${daLoja ? `${daLoja.accessToken}${daLoja.shopId}` : ""}`;
  return createHmac("sha256", chave).update(texto).digest("hex");
}

function agora(): number {
  return Math.floor(Date.now() / 1000);
}

/** Query comum a toda chamada: quem é o parceiro, quando, e a prova. */
function assinada(caminho: string, daLoja?: { accessToken: string; shopId: string }): URLSearchParams {
  const timestamp = agora();
  const p = new URLSearchParams({ partner_id: parceiro().id, timestamp: String(timestamp), sign: assinar(caminho, timestamp, daLoja) });
  if (daLoja) {
    p.set("access_token", daLoja.accessToken);
    p.set("shop_id", daLoja.shopId);
  }
  return p;
}

interface RespostaToken {
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  /** Vazio quando deu certo: a Shopee manda o campo mesmo sem erro. */
  error?: string;
  message?: string;
}

async function pedirToken(caminho: string, corpo: Record<string, unknown>): Promise<TokensRenovados> {
  const r = await fetch(`${base()}${caminho}?${assinada(caminho)}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    // `partner_id` e `shop_id` vão como número no corpo, e como texto na query.
    body: JSON.stringify({ ...corpo, partner_id: Number(parceiro().id) }),
    signal: AbortSignal.timeout(20_000),
  });
  const d = await lerJson<RespostaToken>(r);
  if (d.error || !d.access_token || !d.refresh_token) {
    throw new CanalRecusou(d.message || d.error || `A Shopee respondeu ${r.status} sem token.`);
  }
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiraEmSegundos: validadeEmSegundos(d.expire_in),
    refreshExpiraEmSegundos: TRINTA_DIAS,
  };
}

/** Nome da loja, para o lojista reconhecer na tela. Falhar aqui não derruba a conexão. */
async function nomeDaLoja(accessToken: string, shopId: string): Promise<string | null> {
  const caminho = "/api/v2/shop/get_shop_info";
  try {
    const r = await fetch(`${base()}${caminho}?${assinada(caminho, { accessToken, shopId })}`, { signal: AbortSignal.timeout(15_000) });
    const d = await lerJson<{ shop_name?: string }>(r);
    return d.shop_name?.trim() || null;
  } catch {
    return null;
  }
}

export const shopee: ProvedorDeCanal = {
  canal: "shopee",

  configurado() {
    const { id, chave } = parceiro();
    return /^\d+$/.test(id) && chave.length > 0;
  },

  urlDeAutorizacao(state, retorno) {
    const p = new URLSearchParams({
      partner_id: parceiro().id,
      // `seller` é a loja; os outros tipos (`supplier`, `user`) não vendem aqui.
      auth_type: "seller",
      redirect_uri: retorno,
      response_type: "code",
      state,
    });
    return `${autorizacao()}?${p}`;
  },

  // A Shopee não documenta retorno de recusa: quem desiste na tela dela não volta.
  recusou() {
    return false;
  },

  async trocarCodigo(retorno) {
    const code = retorno.get("code");
    const shopId = retorno.get("shop_id");
    // Conta principal com várias lojas volta com `main_account_id` no lugar do
    // `shop_id`. A plataforma liga uma loja por vez: dizer isso é melhor do que
    // gravar uma conta que não renova.
    if (!code || !shopId || !/^\d+$/.test(shopId)) {
      throw new CanalRecusou(
        retorno.get("main_account_id")
          ? "A autorização veio de uma conta principal, sem loja escolhida. Autorize pela loja."
          : "A Shopee não devolveu o código ou a loja.",
      );
    }

    const tokens = await pedirToken("/api/v2/auth/token/get", { code, shop_id: Number(shopId) });
    return { ...tokens, contaId: shopId, contaNome: await nomeDaLoja(tokens.accessToken, shopId) };
  },

  async renovar(refreshToken, contaId) {
    if (!contaId) throw new CanalRecusou("A conta da Shopee está sem o código da loja. Conecte de novo.");
    return pedirToken("/api/v2/auth/access_token/get", { refresh_token: refreshToken, shop_id: Number(contaId) });
  },
};
