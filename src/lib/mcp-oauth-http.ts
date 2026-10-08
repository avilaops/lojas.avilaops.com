import { LimitadorPorJanela, cabecalhosDoLimite } from "./api-limite";
import { normalizarHost } from "./tenant";

/**
 * O que as rotas do login do conector têm em comum na borda HTTP.
 *
 * As rotas moram na raiz de `src/app`, e por isso respondem também no endereço
 * de cada loja. O servidor de autorização é um só, o do domínio-base: nos
 * outros hosts elas não existem.
 */
const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

export function noDominioBase(request: Request): boolean {
  const h = request.headers;
  return normalizarHost(h.get("x-forwarded-host") ?? h.get("host")) === normalizarHost(BASE);
}

export function naoExiste(): Response {
  return new Response(null, { status: 404 });
}

/**
 * CORS aberto nas rotas de máquina (metadados, registro, token): quem testa um
 * conector pelo navegador chama daqui. Nenhuma delas lê cookie, então não há
 * sessão de lojista para um site de fora aproveitar.
 */
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
} as const;

export function preflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS, "access-control-max-age": "86400" } });
}

/** Resposta de token e de erro de token nunca é guardada (RFC 6749, 5.1). */
export function jsonSemCache(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: { ...CORS, "cache-control": "no-store", pragma: "no-cache" } });
}

export function erroOAuth(erro: string, descricao: string, status = 400): Response {
  return jsonSemCache({ error: erro, error_description: descricao }, status);
}

// ── Limite ─────────────────────────────────────────────────────────────

const limitador = new LimitadorPorJanela();

/**
 * De onde veio a requisição, só para contar. O endereço fica na memória do
 * limitador por um minuto e em mais lugar nenhum: não vai para log, métrica
 * nem banco. Atrás do Cloudflare o endereço real é o `cf-connecting-ip`.
 */
function origemDaRequisicao(request: Request): string {
  const h = request.headers;
  return (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || "sem-origem";
}

/**
 * Tetos por minuto das rotas abertas do login.
 *
 * O registro é aberto por definição do protocolo, e cada um grava uma linha:
 * sem teto, um laço enche a tabela. Por origem, para o laço de um não fechar a
 * porta de todos; e no total, para o caso de o laço vir de muitas origens.
 */
export const LIMITES_DO_LOGIN = {
  registroPorOrigem: 10,
  registroNoTotal: 120,
  tokenPorCliente: 30,
} as const;

/** `null` quando pode seguir; a resposta 429 quando o teto foi atingido. */
function recusaPorLimite(chave: string, limite: number): Response | null {
  const r = limitador.consumir(chave, limite);
  if (r.permitido) return null;
  return Response.json(
    { error: "slow_down", error_description: `Muitas requisições. Tente de novo em ${r.reiniciaEm} s.` },
    { status: 429, headers: { ...CORS, ...cabecalhosDoLimite(r), "retry-after": String(r.reiniciaEm), "cache-control": "no-store" } },
  );
}

export function limiteDoRegistro(request: Request): Response | null {
  return (
    recusaPorLimite(`registro:${origemDaRequisicao(request)}`, LIMITES_DO_LOGIN.registroPorOrigem) ??
    recusaPorLimite("registro:total", LIMITES_DO_LOGIN.registroNoTotal)
  );
}

export function limiteDoToken(clienteId: string): Response | null {
  return recusaPorLimite(`token:${clienteId.slice(0, 64)}`, LIMITES_DO_LOGIN.tokenPorCliente);
}
