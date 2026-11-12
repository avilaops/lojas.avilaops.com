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
const API_SANDBOX = "https://openplatform.sandbox.test-stable.shopee.sg";
const AUTORIZACAO_SANDBOX = "https://open.sandbox.test-stable.shopee.com.br/auth";
const TRINTA_DIAS = 30 * 86_400;
const QUATRO_HORAS = 4 * 3600;

type Configuracao = { id: string; chave: string; api: string; autorizacao: string };

function idValido(id: string | null): id is string {
  return typeof id === "string" && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
}

/** O segredo e os tokens só podem sair para os endpoints oficiais declarados. */
function endpoint(valor: string, permitidos: readonly string[]): string | null {
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    const normalizado = `${url.origin}${url.pathname}`.replace(/\/+$/, "");
    return permitidos.includes(normalizado) ? normalizado : null;
  } catch {
    return null;
  }
}

function configuracao(): Configuracao | null {
  const id = (process.env.SHOPEE_PARTNER_ID ?? "").trim();
  const chave = (process.env.SHOPEE_PARTNER_KEY ?? "").trim();
  if (!idValido(id) || !chave) return null;
  const api = endpoint(process.env.SHOPEE_URL?.trim() || API, [API, API_SANDBOX]);
  if (!api) return null;
  const sandbox = api === API_SANDBOX;
  const paginas = sandbox
    ? [AUTORIZACAO_SANDBOX, "https://open.sandbox.test-stable.shopee.com/auth"]
    : [AUTORIZACAO, "https://open.shopee.com/auth"];
  const autorizacao = endpoint(process.env.SHOPEE_AUTH_URL?.trim() || paginas[0], paginas);
  return autorizacao ? { id, chave, api, autorizacao } : null;
}

function exigirConfiguracao(): Configuracao {
  const config = configuracao();
  if (!config) throw new CanalRecusou("A integração Shopee não está configurada corretamente.");
  return config;
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
  if (typeof expireIn !== "number" || !Number.isSafeInteger(expireIn)) throw new CanalRecusou("A Shopee devolveu validade inválida.");
  const duracao = expireIn > 1_000_000_000 ? expireIn - agoraEmSegundos : expireIn;
  if (duracao <= 0 || duracao > QUATRO_HORAS) throw new CanalRecusou("A Shopee devolveu validade inválida.");
  return duracao;
}

/**
 * A assinatura de uma chamada.
 *
 * A base é `partner_id + caminho + timestamp`, e as chamadas feitas em nome de
 * uma loja acrescentam `access_token + shop_id` no fim. Pedir e renovar token
 * são chamadas do parceiro, e não levam os dois. A hora vale cinco minutos.
 */
export function assinar(caminho: string, timestamp: number, daLoja?: { accessToken: string; shopId: string }): string {
  return assinarCom(exigirConfiguracao(), caminho, timestamp, daLoja);
}

function assinarCom({ id, chave }: Configuracao, caminho: string, timestamp: number, daLoja?: { accessToken: string; shopId: string }): string {
  const texto = `${id}${caminho}${timestamp}${daLoja ? `${daLoja.accessToken}${daLoja.shopId}` : ""}`;
  return createHmac("sha256", chave).update(texto).digest("hex");
}

function agora(): number {
  return Math.floor(Date.now() / 1000);
}

/** Query comum a toda chamada: quem é o parceiro, quando, e a prova. */
function assinada(config: Configuracao, caminho: string, daLoja?: { accessToken: string; shopId: string }): URLSearchParams {
  const timestamp = agora();
  const p = new URLSearchParams({ partner_id: config.id, timestamp: String(timestamp), sign: assinarCom(config, caminho, timestamp, daLoja) });
  if (daLoja) {
    p.set("access_token", daLoja.accessToken);
    p.set("shop_id", daLoja.shopId);
  }
  return p;
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

async function pedirToken(config: Configuracao, caminho: string, corpo: Record<string, unknown>): Promise<TokensRenovados> {
  let r: Response;
  try {
    r = await fetch(`${config.api}${caminho}?${assinada(config, caminho)}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ ...corpo, partner_id: Number(config.id) }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    // A URL assinada, erros de rede e mensagens do provedor podem conter tokens.
    throw new CanalRecusou("Não foi possível consultar a Shopee. Tente conectar novamente.");
  }
  const d = await lerJson<unknown>(r);
  if (!r.ok || !objeto(d) || (d.error !== undefined && d.error !== "")) {
    throw new CanalRecusou(`A Shopee recusou a conexão (HTTP ${r.status}).`);
  }
  const accessToken = texto(d.access_token);
  const refreshToken = texto(d.refresh_token);
  if (!accessToken || !refreshToken) throw new CanalRecusou("A Shopee devolveu credenciais inválidas.");
  return {
    accessToken,
    refreshToken,
    expiraEmSegundos: validadeEmSegundos(d.expire_in),
    refreshExpiraEmSegundos: TRINTA_DIAS,
  };
}

/** Nome da loja, para o lojista reconhecer na tela. Falhar aqui não derruba a conexão. */
async function nomeDaLoja(config: Configuracao, accessToken: string, shopId: string): Promise<string | null> {
  const caminho = "/api/v2/shop/get_shop_info";
  try {
    const r = await fetch(`${config.api}${caminho}?${assinada(config, caminho, { accessToken, shopId })}`, {
      signal: AbortSignal.timeout(15_000), redirect: "error", cache: "no-store",
    });
    if (!r.ok) return null;
    const d = await lerJson<unknown>(r);
    return objeto(d) ? texto(d.shop_name) : null;
  } catch {
    return null;
  }
}

export const shopee: ProvedorDeCanal = {
  canal: "shopee",

  configurado() {
    return configuracao() !== null;
  },

  urlDeAutorizacao(state, retorno) {
    const config = exigirConfiguracao();
    const p = new URLSearchParams({
      partner_id: config.id,
      // `seller` é a loja; os outros tipos (`supplier`, `user`) não vendem aqui.
      auth_type: "seller",
      redirect_uri: retorno,
      response_type: "code",
      state,
    });
    return `${config.autorizacao}?${p}`;
  },

  // A Shopee não documenta retorno de recusa: quem desiste na tela dela não volta.
  recusou() {
    return false;
  },

  async trocarCodigo(retorno) {
    const config = exigirConfiguracao();
    const code = texto(retorno.get("code"));
    const shopId = retorno.get("shop_id");
    // Conta principal com várias lojas volta com `main_account_id` no lugar do
    // `shop_id`. A plataforma liga uma loja por vez: dizer isso é melhor do que
    // gravar uma conta que não renova.
    if (!code || !idValido(shopId)) {
      throw new CanalRecusou(
        retorno.get("main_account_id")
          ? "A autorização veio de uma conta principal, sem loja escolhida. Autorize pela loja."
          : "A Shopee não devolveu o código ou a loja.",
      );
    }

    const tokens = await pedirToken(config, "/api/v2/auth/token/get", { code, shop_id: Number(shopId) });
    return { ...tokens, contaId: shopId, contaNome: await nomeDaLoja(config, tokens.accessToken, shopId) };
  },

  async renovar(refreshToken, contaId) {
    const config = exigirConfiguracao();
    if (!idValido(contaId)) throw new CanalRecusou("A conta da Shopee está sem o código da loja válido. Conecte de novo.");
    const refresh = texto(refreshToken);
    if (!refresh) throw new CanalRecusou("A Shopee está sem credencial de renovação. Conecte de novo.");
    return pedirToken(config, "/api/v2/auth/access_token/get", { refresh_token: refresh, shop_id: Number(contaId) });
  },
};
