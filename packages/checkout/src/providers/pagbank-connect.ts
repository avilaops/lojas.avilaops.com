/**
 * PagBank Connect: o aplicativo é da plataforma (`PAGBANK_CLIENT_ID` e
 * `PAGBANK_CLIENT_SECRET`); a conta é do lojista.
 *
 * A autorização está em developer.pagbank.com.br (Connect). O `redirect_uri`
 * é o argumento `retorno`, o mesmo que a tela registra no app:
 * `https://lojas.avilaops.com/api/painel/recebimento/v2/conectar/pagbank/retorno`
 * (ou o domínio de `LOJAS_BASE_DOMAIN`, se for outro).
 *
 * A troca do código segue o OpenAPI "Obter access token": `POST /oauth2/token`
 * com os headers `X_CLIENT_ID` e `X_CLIENT_SECRET`. Não mandamos `Authorization`
 * nessa chamada: ainda não há bearer, e o segredo do aplicativo não vai nesse
 * header.
 */

const CONNECT = {
  producao: "https://connect.pagbank.com.br",
  sandbox: "https://connect.sandbox.pagbank.com.br",
} as const;

const API = {
  producao: "https://api.pagseguro.com",
  sandbox: "https://sandbox.api.pagseguro.com",
} as const;

/**
 * Escopos publicados para criar cobrança, consultar, estornar e ler a conta.
 * O separador é `+`, como a documentação pede. `URLSearchParams` codifica o
 * `+` como `%2B`; o PagBank devolve o valor original ao decodificar.
 */
const ESCOPO = "payments.create+payments.refund+accounts.read";

const TEMPO_LIMITE_TOKEN_MS = 20_000;
const TEMPO_LIMITE_LEITURA_MS = 10_000;

type Ambiente = keyof typeof API;

export interface ResultadoConnect {
  segredos: Record<string, string | undefined>;
  publicos: Record<string, string | undefined>;
  conta?: string;
}

function ambiente(): Ambiente {
  return process.env.PAGBANK_AMBIENTE === "sandbox" ? "sandbox" : "producao";
}

function credenciaisDoAplicativo(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PAGBANK_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.PAGBANK_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("PagBank Connect sem PAGBANK_CLIENT_ID ou PAGBANK_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

/** URL da tela de autorização. `estado` volta igual em `?state=`. */
export function urlDeAutorizacao(estado: string, retorno: string): string {
  const { clientId } = credenciaisDoAplicativo();
  const parametros = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: retorno,
    scope: ESCOPO,
    state: estado,
  });
  return `${CONNECT[ambiente()]}/oauth2/authorize?${parametros}`;
}

/**
 * Troca o `code` pelos segredos da credencial.
 *
 * Chave de cartão, chave de webhook e rótulo da conta são o melhor esforço:
 * Pix e boleto cobram sem a chave de cartão, e a primeira notificação ainda
 * consegue buscar a chave de webhook. Falha nessas leituras não desfaz o
 * token. Falha na troca do código lança, para a tela marcar a conexão como
 * falha.
 */
export async function concluir(codigo: string, retorno: string): Promise<ResultadoConnect> {
  const code = codigo.trim();
  if (!code) throw new Error("O PagBank não devolveu o código de autorização.");
  const { clientId, clientSecret } = credenciaisDoAplicativo();
  const amb = ambiente();
  const base = API[amb];

  let resposta: Response;
  try {
    resposta = await fetch(`${base}/oauth2/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        X_CLIENT_ID: clientId,
        X_CLIENT_SECRET: clientSecret,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: retorno,
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_TOKEN_MS),
    });
  } catch {
    throw new Error("Não consegui falar com o PagBank para concluir a conexão.");
  }

  const dados = (await resposta.json().catch(() => ({}))) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    account_id?: unknown;
  };
  const accessToken = texto(dados.access_token);
  if (!resposta.ok || !accessToken) {
    throw new Error("O PagBank não devolveu o acesso da conta.");
  }

  const publicKey = await chavePublica(base, accessToken, "card");
  const chavePublicaWebhook = await chavePublica(base, accessToken, "webhook");
  const accountId = texto(dados.account_id);
  const conta = accountId ? await rotuloDaConta(base, accessToken, accountId) : undefined;

  return {
    segredos: {
      accessToken,
      refreshToken: texto(dados.refresh_token) || undefined,
      chavePublicaWebhook,
      expiresEm: instanteDeExpiracao(dados.expires_in),
      ambiente: amb === "sandbox" ? "sandbox" : undefined,
    },
    publicos: { publicKey },
    conta,
  };
}

async function chavePublica(base: string, token: string, tipo: "card" | "webhook"): Promise<string | undefined> {
  try {
    const lida = await fetch(`${base}/public-keys/${tipo}`, {
      headers: autorizacao(token),
      signal: AbortSignal.timeout(TEMPO_LIMITE_LEITURA_MS),
    });
    if (lida.ok) return chaveDe(await lida.json().catch(() => ({})));
    if (lida.status !== 404) return undefined;
    const criada = await fetch(`${base}/public-keys`, {
      method: "POST",
      headers: { ...autorizacao(token), "content-type": "application/json" },
      body: JSON.stringify({ type: tipo }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_LEITURA_MS),
    });
    if (!criada.ok) return undefined;
    return chaveDe(await criada.json().catch(() => ({})));
  } catch {
    return undefined;
  }
}

/**
 * `GET /accounts/{id}` está documentado, mas o header de autenticação do
 * Connect (Bearer ou `x-client-token`) não está fechado. Mandamos os dois.
 * Se a leitura falhar, o rótulo fica o próprio `account_id`.
 */
async function rotuloDaConta(base: string, token: string, accountId: string): Promise<string> {
  try {
    const resposta = await fetch(`${base}/accounts/${encodeURIComponent(accountId)}`, {
      headers: { ...autorizacao(token), "x-client-token": token },
      signal: AbortSignal.timeout(TEMPO_LIMITE_LEITURA_MS),
    });
    if (!resposta.ok) return accountId;
    const rotulo = rotuloDe(await resposta.json().catch(() => ({})));
    return rotulo || accountId;
  } catch {
    return accountId;
  }
}

function autorizacao(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, accept: "application/json" };
}

function chaveDe(dados: unknown): string | undefined {
  if (!dados || typeof dados !== "object") return undefined;
  const chave = texto((dados as { public_key?: unknown }).public_key);
  return chave || undefined;
}

function rotuloDe(dados: unknown): string {
  if (!dados || typeof dados !== "object") return "";
  const o = dados as Record<string, unknown>;
  const company = objeto(o.company);
  const person = objeto(o.person);
  const nome = texto(company.name) || texto(person.name) || texto(o.name);
  const email = texto(o.email);
  return [nome, email].filter(Boolean).join(" · ");
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** `expires_in` vem em segundos, número ou texto. Texto que não é número fica de fora. */
function instanteDeExpiracao(valor: unknown): string | undefined {
  const segundos = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor) : Number.NaN;
  if (!Number.isFinite(segundos) || segundos <= 0) return undefined;
  return new Date(Date.now() + segundos * 1000).toISOString();
}
