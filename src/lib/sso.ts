/**
 * Entrada no painel pelo login único da Avila Ops (auth.avilaops.com).
 *
 * É uma segunda porta, ao lado da senha da loja, e não a substitui: o lojista
 * que se cadastrou aqui continua entrando como sempre. A sessão do painel é a
 * mesma nos dois casos (`lojas_sessao`); o login único só responde "quem é
 * esta pessoa" e "ela pode entrar no Lojas".
 *
 * Quem decide a segunda pergunta é o Auth, não este arquivo. O cookie
 * `avila_sso` vale em todo `*.avilaops.com`, então chega aqui também de quem
 * logou em outro sistema e nunca foi liberado para o Lojas. Por isso o token
 * não é conferido localmente: ele vai ao `/api/session?app=…` do Auth, que
 * aplica a regra do cadastro de aplicações. De quebra, o Lojas não precisa
 * guardar o segredo que assina a sessão de todos os outros sistemas.
 */

export const COOKIE_SSO = "avila_sso";

export type ConfigSSO = { url: string; app: string };

/**
 * Ligado só quando `SSO_APP_ID` existe. Sem ele o botão não aparece e a rota
 * responde 404: o código pode ir ao ar antes de o Lojas estar marcado no Auth
 * como app que recebe sessão.
 */
export function configSSO(env: Record<string, string | undefined> = process.env): ConfigSSO | null {
  const app = (env.SSO_APP_ID ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(app)) return null;
  const url = (env.SSO_URL ?? "https://auth.avilaops.com").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url)) return null;
  return { url, app };
}

/** Caminho, neste app, para onde o Auth devolve a pessoa depois do login. */
export const CAMINHO_RETORNO = "/api/painel/entrar/sso";

/**
 * Tela de login do Auth, voltando para cá.
 *
 * `volta=1` marca que já fomos ao Auth uma vez. Se a pessoa retornar e a
 * sessão continuar não chegando (cookie bloqueado, domínio diferente), a rota
 * para em vez de mandar de novo: o Auth devolve na hora quem já está logado, e
 * sem a marca os dois lados ficariam se mandando um ao outro para sempre.
 */
export function urlDeLoginSSO(cfg: ConfigSSO, hostBase: string): string {
  const retorno = `https://${hostBase}${CAMINHO_RETORNO}?volta=1`;
  return `${cfg.url}/login?app=${encodeURIComponent(cfg.app)}&returnTo=${encodeURIComponent(retorno)}`;
}

export type RespostaSSO =
  | { tipo: "sem_sessao" }
  | { tipo: "sem_acesso"; email: string }
  | { tipo: "ok"; email: string; nome: string }
  | { tipo: "indisponivel" };

/**
 * Traduz a resposta do `/api/session?app=…`.
 *
 * Fecha em tudo que não for um "sim" explícito. Auth antigo, que não conhece
 * `?app=`, responde sem `permitido`: isso é "não liberado", nunca "liberado
 * por omissão".
 */
export function lerRespostaSSO(status: number, corpo: unknown): RespostaSSO {
  if (status === 401) return { tipo: "sem_sessao" };
  if (status !== 200 || typeof corpo !== "object" || corpo === null) return { tipo: "indisponivel" };

  const c = corpo as { autenticado?: unknown; permitido?: unknown; sessao?: { email?: unknown; nome?: unknown } };
  if (c.autenticado !== true) return { tipo: "sem_sessao" };

  const email = typeof c.sessao?.email === "string" ? c.sessao.email.trim().toLowerCase() : "";
  if (!email.includes("@")) return { tipo: "indisponivel" };
  if (c.permitido !== true) return { tipo: "sem_acesso", email };

  return { tipo: "ok", email, nome: typeof c.sessao?.nome === "string" ? c.sessao.nome : "" };
}

/** Três blocos base64url separados por ponto: o formato de um JWT. */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Pergunta ao Auth quem é o dono deste cookie e se pode entrar aqui.
 *
 * O token vira o valor de um cabeçalho `Cookie` montado à mão, então só segue
 * se tiver cara de JWT: qualquer outro caractere (`;`, quebra de linha) seria
 * um cabeçalho forjado por quem controla o próprio cookie.
 */
export async function consultarSSO(
  cfg: ConfigSSO,
  token: string | undefined,
  buscar: typeof fetch = fetch,
): Promise<RespostaSSO> {
  if (!token || !FORMATO_TOKEN.test(token)) return { tipo: "sem_sessao" };
  try {
    const r = await buscar(`${cfg.url}/api/session?app=${encodeURIComponent(cfg.app)}`, {
      headers: { cookie: `${COOKIE_SSO}=${token}`, accept: "application/json" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    return lerRespostaSSO(r.status, await r.json().catch(() => null));
  } catch {
    return { tipo: "indisponivel" };
  }
}

/** Recados da tela de entrada, pela chave que vem em `?sso=`. */
export const RECADOS_SSO: Record<string, string> = {
  "sem-loja": "Sua conta Avila Ops não está ligada a nenhuma loja. Entre com o e-mail e a senha da loja, ou peça ao dono para cadastrar este e-mail na equipe.",
  "sem-acesso": "Sua conta Avila Ops ainda não foi liberada para o Lojas. Entre com o e-mail e a senha da loja.",
  indisponivel: "Não foi possível falar com o login da Avila Ops agora. Entre com o e-mail e a senha da loja.",
};
