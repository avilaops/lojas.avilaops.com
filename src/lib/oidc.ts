import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cifrar, decifrar } from "./cofre";
import { configSSO, type ConfigSSO, type RespostaSSO } from "./sso";

export const COOKIE_FLUXO_OIDC = "lojas_oidc_fluxo";
export const COOKIE_SESSAO_OIDC = "lojas_oidc_sessao";
const CALLBACK = "/api/painel/entrar/oidc";
type ConfigOIDC = ConfigSSO & { clientId: string; secret: string; redirectUri: string; origem: string; segura: boolean };
type Fluxo = { tipo: "fluxo-oidc"; state: string; nonce: string; verifier: string; exp: number };
type Sessao = { tipo: "sessao-oidc"; token: string; sub: string; exp: number };

export function configOIDC(env: Record<string, string | undefined> = process.env): ConfigOIDC | null {
  const sso = configSSO(env);
  const clientId = env.LOJAS_OIDC_CLIENT_ID?.trim();
  const secret = env.LOJAS_OIDC_CLIENT_SECRET?.trim();
  if (!sso || !clientId || !secret || !env.LOJAS_OIDC_REDIRECT_URI) return null;
  try {
    const url = new URL(env.LOJAS_OIDC_REDIRECT_URI);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.username || url.password || url.search || url.hash || url.pathname !== CALLBACK) return null;
    if (url.hostname !== (env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase()) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local && env.NODE_ENV !== "production")) return null;
    return { ...sso, clientId, secret, redirectUri: url.toString(), origem: url.origin, segura: url.protocol === "https:" };
  } catch { return null; }
}

export function criarFluxoOIDC(agora = Date.now()) {
  const fluxo: Fluxo = { tipo: "fluxo-oidc", state: randomBytes(32).toString("base64url"), nonce: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url"), exp: agora + 600_000 };
  return { ...fluxo, cookie: cifrar(JSON.stringify(fluxo)) };
}

export function lerFluxoOIDC(cookie: string | undefined, state: string | null, agora = Date.now()): Fluxo | null {
  if (!cookie || !state || cookie.length > 3800 || state.length > 128) return null;
  try {
    const fluxo = JSON.parse(decifrar(cookie)) as Fluxo;
    if (fluxo.tipo !== "fluxo-oidc" || typeof fluxo.state !== "string" || typeof fluxo.nonce !== "string" || typeof fluxo.verifier !== "string" || typeof fluxo.exp !== "number" || fluxo.exp <= agora) return null;
    if (Buffer.byteLength(state) !== Buffer.byteLength(fluxo.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(fluxo.state))) return null;
    return fluxo;
  } catch { return null; }
}

export function urlAutorizacaoOIDC(cfg: ConfigOIDC, fluxo: Fluxo): string {
  const url = new URL("/oauth/authorize", cfg.url);
  url.search = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: "openid profile email", state: fluxo.state, nonce: fluxo.nonce, code_challenge: createHash("sha256").update(fluxo.verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return url.toString();
}

export function lerIdentidadeOIDC(corpo: unknown, app: string, sub: string): RespostaSSO {
  if (!corpo || typeof corpo !== "object") return { tipo: "sem_sessao" };
  const c = corpo as Record<string, unknown>;
  if (c.sub !== sub) return { tipo: "sem_sessao" };
  if (typeof c.email !== "string" || !c.email.includes("@") || c.email_verified !== true) return { tipo: "sem_email" };
  const email = c.email.trim().toLowerCase();
  if (!Array.isArray(c.apps) || !c.apps.includes(app)) return { tipo: "sem_acesso", email };
  return { tipo: "ok", email, nome: typeof c.name === "string" ? c.name : "", equipe: c.papel === "ADMIN" };
}

const chaves = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function trocarCodigoOIDC(cfg: ConfigOIDC, fluxo: Fluxo, code: string) {
  const resposta = await fetch(`${cfg.url}/oauth/token`, {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.secret)}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri, code_verifier: fluxo.verifier }),
  });
  const tokens = await resposta.json() as { access_token?: unknown; id_token?: unknown; expires_in?: unknown };
  if (!resposta.ok || typeof tokens.access_token !== "string" || typeof tokens.id_token !== "string") throw new Error("OIDC recusado");
  let jwks = chaves.get(cfg.url);
  if (!jwks) { jwks = createRemoteJWKSet(new URL("/oauth/jwks", cfg.url), { timeoutDuration: 8000 }); chaves.set(cfg.url, jwks); }
  const { payload } = await jwtVerify(tokens.id_token, jwks, { issuer: cfg.url, audience: cfg.clientId, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat", "nonce"], maxTokenAge: "10m" });
  if (payload.nonce !== fluxo.nonce || !payload.sub || !payload.exp) throw new Error("OIDC inválido");
  const exp = Math.min(payload.exp * 1000, Date.now() + 3_600_000, typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : Infinity);
  if (exp <= Date.now()) throw new Error("OIDC expirado");
  const sessao: Sessao = { tipo: "sessao-oidc", token: tokens.access_token, sub: payload.sub, exp };
  const envelope = cifrar(JSON.stringify(sessao));
  if (envelope.length > 3800) throw new Error("Sessão OIDC indisponível");
  const identidade = await consultarSessaoOIDC(cfg, envelope);
  if (identidade.tipo !== "ok") throw new Error("OIDC não autorizado");
  return { envelope, maxAge: Math.max(1, Math.floor((exp - Date.now()) / 1000)) };
}

export async function consultarSessaoOIDC(cfg: ConfigOIDC, envelope: string | undefined): Promise<RespostaSSO> {
  if (!envelope || envelope.length > 3800) return { tipo: "sem_sessao" };
  let sessao: Sessao;
  try {
    sessao = JSON.parse(decifrar(envelope)) as Sessao;
    if (sessao.tipo !== "sessao-oidc" || typeof sessao.exp !== "number" || sessao.exp <= Date.now() || typeof sessao.token !== "string" || typeof sessao.sub !== "string") return { tipo: "sem_sessao" };
  } catch { return { tipo: "sem_sessao" }; }
  try {
    const resposta = await fetch(`${cfg.url}/oauth/userinfo`, { headers: { authorization: `Bearer ${sessao.token}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (resposta.status === 401) return { tipo: "sem_sessao" };
    if (!resposta.ok) return { tipo: "indisponivel" };
    return lerIdentidadeOIDC(await resposta.json(), cfg.app, sessao.sub);
  } catch { return { tipo: "indisponivel" }; }
}
