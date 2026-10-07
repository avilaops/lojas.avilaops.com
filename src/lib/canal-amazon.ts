import { CanalRecusou, lerJson, type ProvedorDeCanal, type TokensRenovados } from "./canal-oauth";

/**
 * Amazon Selling Partner API: autorização do vendedor pelo site.
 *
 * O consentimento acontece no Seller Central e o token sai do Login with
 * Amazon. Quatro detalhes do contrato que custam:
 *
 *   - quem identifica o aplicativo na autorização é o **application id**
 *     (`amzn1.sellerapps.app.…`), não o `client_id`. O `client_id` e o
 *     `client_secret` só entram depois, na troca do código;
 *   - a URL de consentimento **não leva `redirect_uri`**: a Amazon volta para
 *     o primeiro endereço de retorno registrado no aplicativo. Ele só é
 *     enviado na troca do código, e tem de ser o mesmo;
 *   - o código volta em `spapi_oauth_code`, não em `code`, junto do
 *     `selling_partner_id` do vendedor;
 *   - aplicativo ainda em rascunho só autoriza com `version=beta` na URL
 *     (`AMAZON_APP_RASCUNHO=1`). Sem isso o Seller Central responde que o
 *     aplicativo não existe;
 *   - o acesso vale 1 hora e o **refresh não é trocado**: a renovação devolve
 *     o acesso novo, e o refresh guardado continua valendo. A Amazon exige que
 *     o vendedor autorize de novo a cada 365 dias.
 *
 * Este é o fluxo que começa no nosso painel. Quem começar pela Appstore da
 * Amazon cai no "Login URI" do aplicativo, que a plataforma ainda não atende.
 */

const SELLER_CENTRAL = "https://sellercentral.amazon.com.br";
const TOKEN = "https://api.amazon.com/auth/o2/token";
/** O Brasil é atendido pela região das Américas da SP-API. */
const API = "https://sellingpartnerapi-na.amazon.com";
const UM_ANO = 365 * 86_400;

function sellerCentral(): string {
  return (process.env.AMAZON_SELLER_CENTRAL_URL || SELLER_CENTRAL).replace(/\/+$/, "");
}

interface RespostaToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({
      client_id: process.env.AMAZON_CLIENT_ID ?? "",
      client_secret: process.env.AMAZON_CLIENT_SECRET ?? "",
      ...corpo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const d = await lerJson<RespostaToken>(r);
  if (d.error || !d.access_token) {
    throw new CanalRecusou(d.error_description || d.error || `A Amazon respondeu ${r.status} sem token.`);
  }
  return d;
}

/**
 * Nome da loja no marketplace do Brasil. Falhar aqui não derruba a conexão: o
 * lojista ainda vê o código de vendedor na tela.
 */
async function nomeDaLoja(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch(`${API}/sellers/v1/marketplaceParticipations`, {
      // A SP-API recusa chamada sem `user-agent` que identifique o aplicativo.
      headers: { accept: "application/json", "x-amz-access-token": accessToken, "user-agent": "LojasAvilaOps/1.0 (Language=TypeScript)" },
      signal: AbortSignal.timeout(15_000),
    });
    const d = await lerJson<{ payload?: Array<{ marketplace?: { countryCode?: string }; storeName?: string }> }>(r);
    const lojas = d.payload ?? [];
    const daqui = lojas.find((l) => l.marketplace?.countryCode === "BR") ?? lojas[0];
    return daqui?.storeName?.trim() || null;
  } catch {
    return null;
  }
}

export const amazon: ProvedorDeCanal = {
  canal: "amazon",

  configurado() {
    return Boolean(process.env.AMAZON_APP_ID && process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET);
  },

  urlDeAutorizacao(state) {
    const p = new URLSearchParams({ application_id: process.env.AMAZON_APP_ID ?? "", state });
    if (process.env.AMAZON_APP_RASCUNHO === "1") p.set("version", "beta");
    return `${sellerCentral()}/apps/authorize/consent?${p}`;
  },

  recusou(retorno) {
    return Boolean(retorno.get("error"));
  },

  async trocarCodigo(retorno, urlDeRetorno) {
    const code = retorno.get("spapi_oauth_code");
    if (!code) throw new CanalRecusou("A Amazon não devolveu o código de autorização.");

    const d = await pedirToken({ grant_type: "authorization_code", code, redirect_uri: urlDeRetorno });
    if (!d.refresh_token) throw new CanalRecusou("A Amazon não devolveu o refresh token.");

    return {
      accessToken: d.access_token!,
      refreshToken: d.refresh_token,
      expiraEmSegundos: d.expires_in ?? 3600,
      refreshExpiraEmSegundos: UM_ANO,
      contaId: retorno.get("selling_partner_id"),
      contaNome: await nomeDaLoja(d.access_token!),
    };
  },

  async renovar(refreshToken): Promise<TokensRenovados> {
    const d = await pedirToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    return {
      accessToken: d.access_token!,
      // A Amazon não troca o refresh: quando ele não vem, o guardado continua valendo.
      refreshToken: d.refresh_token ?? refreshToken,
      expiraEmSegundos: d.expires_in ?? 3600,
      refreshExpiraEmSegundos: null,
    };
  },
};
