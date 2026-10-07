import { CanalRecusou, lerJson, type ProvedorDeCanal, type TokensRenovados } from "./canal-oauth";

/**
 * Magalu (Open API de sellers): autorização pelo ID Magalu.
 *
 * É OAuth2 de livro, com três detalhes que custam:
 *
 *   - o lojista escolhe **em nome de qual conta** autoriza (`choose_tenants`):
 *     quem tem mais de um CNPJ no Parceiro Magalu precisa dessa tela, senão o
 *     token sai para a conta pessoal, que não vende nada;
 *   - os escopos são pedidos na autorização e **não crescem depois**. Token
 *     emitido sem o escopo de pedido não lê pedido nunca: o lojista teria de
 *     conectar de novo. Por isso a lista já nasce com o que a publicação e a
 *     venda vão precisar;
 *   - a troca do código vai em JSON e a **renovação vai em formulário**. São o
 *     mesmo endereço com dois formatos, e é assim que a documentação mostra
 *     cada um;
 *   - o acesso vale 2 horas. A renovação devolve um refresh, e é sempre o que
 *     veio por último que fica guardado.
 */

const ID = "https://id.magalu.com";
const API = "https://api.magalu.com";

/**
 * O que a plataforma vai precisar para anunciar e receber a venda: catálogo,
 * preço, estoque e pedido. `MAGALU_ESCOPOS` troca a lista sem deploy, porque o
 * conjunto liberado depende do que o Magalu aprovou no aplicativo.
 */
const ESCOPOS_PADRAO = [
  "open:portfolio-skus-seller:read",
  "open:portfolio-skus-seller:write",
  "open:portfolio-stocks-seller:read",
  "open:portfolio-stocks-seller:write",
  "open:portfolio-prices-seller:read",
  "open:portfolio-prices-seller:write",
  "open:order-order-seller:read",
  "open:order-delivery-seller:read",
  "open:order-delivery-seller:write",
  "open:order-invoice-seller:read",
];

export function escopos(): string {
  const doAmbiente = (process.env.MAGALU_ESCOPOS ?? "").trim();
  return doAmbiente || ESCOPOS_PADRAO.join(" ");
}

interface RespostaToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  message?: string;
}

async function pedirToken(formato: "json" | "formulario", corpo: Record<string, string>, refreshAtual?: string): Promise<TokensRenovados> {
  const campos = {
    client_id: process.env.MAGALU_CLIENT_ID ?? "",
    client_secret: process.env.MAGALU_CLIENT_SECRET ?? "",
    ...corpo,
  };
  const r = await fetch(`${ID}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": formato === "json" ? "application/json" : "application/x-www-form-urlencoded",
    },
    body: formato === "json" ? JSON.stringify(campos) : new URLSearchParams(campos),
    signal: AbortSignal.timeout(20_000),
  });
  const d = await lerJson<RespostaToken>(r);
  // Na renovação, se o refresh não vier, o que está guardado continua valendo.
  const refreshToken = d.refresh_token ?? refreshAtual;
  if (d.error || !d.access_token || !refreshToken) {
    throw new CanalRecusou(d.error_description || d.message || d.error || `O Magalu respondeu ${r.status} sem token.`);
  }
  return {
    accessToken: d.access_token,
    refreshToken,
    expiraEmSegundos: d.expires_in ?? 2 * 3600,
    refreshExpiraEmSegundos: null,
  };
}

/**
 * A loja por trás do token, como o Magalu a chama. Falhar aqui não derruba a
 * conexão: sobra o que dá para ler do próprio token.
 */
async function lojaDoToken(accessToken: string): Promise<{ id: string | null; nome: string | null }> {
  try {
    const r = await fetch(`${API}/seller/v1/portfolios/me`, {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return { id: null, nome: null };
    const d = await lerJson<{ tenant?: { id?: string }; channel?: { name?: string }; seller?: { id?: string; name?: string } }>(r);
    return { id: d.seller?.id ?? d.tenant?.id ?? null, nome: d.seller?.name?.trim() || d.channel?.name?.trim() || null };
  } catch {
    return { id: null, nome: null };
  }
}

/**
 * De quem é a conta, lido do próprio token: a reserva para quando a consulta
 * da loja falha.
 *
 * O acesso do ID Magalu é um JWT, e o que identifica a conta está nele. Lemos
 * sem conferir a assinatura porque é só rótulo de tela, para o lojista
 * reconhecer o que conectou: nenhuma decisão depende deste texto.
 */
export function contaDoToken(accessToken: string): { id: string | null; nome: string | null } {
  try {
    const corpo = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      id: texto(corpo.tenant) ?? texto(corpo.sub),
      nome: texto(corpo.name) ?? texto(corpo.email) ?? texto(corpo.preferred_username),
    };
  } catch {
    return { id: null, nome: null };
  }
}

export const magalu: ProvedorDeCanal = {
  canal: "magalu",

  configurado() {
    return Boolean(process.env.MAGALU_CLIENT_ID && process.env.MAGALU_CLIENT_SECRET);
  },

  urlDeAutorizacao(state, retorno) {
    const p = new URLSearchParams({
      client_id: process.env.MAGALU_CLIENT_ID ?? "",
      redirect_uri: retorno,
      scope: escopos(),
      response_type: "code",
      choose_tenants: "true",
      state,
    });
    return `${ID}/login?${p}`;
  },

  recusou(retorno) {
    return Boolean(retorno.get("error"));
  },

  async trocarCodigo(retorno, urlDeRetorno) {
    const code = retorno.get("code");
    if (!code) throw new CanalRecusou("O Magalu não devolveu o código de autorização.");

    const tokens = await pedirToken("json", { grant_type: "authorization_code", code, redirect_uri: urlDeRetorno });
    const [loja, conta] = [await lojaDoToken(tokens.accessToken), contaDoToken(tokens.accessToken)];
    return { ...tokens, contaId: loja.id ?? conta.id, contaNome: loja.nome ?? conta.nome };
  },

  renovar(refreshToken) {
    return pedirToken("formulario", { grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);
  },
};
