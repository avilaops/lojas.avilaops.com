import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * O login do conector MCP: as regras, sem banco.
 *
 * O lojista cola a URL do conector no assistente (Claude, ChatGPT, Codex), o
 * assistente descobre sozinho onde autorizar, o lojista entra no painel e
 * confirma. Ninguém copia chave. É o fluxo de autorização do próprio MCP:
 * metadados do recurso (RFC 9728) e do servidor de autorização (RFC 8414),
 * registro dinâmico de cliente (RFC 7591) e código de autorização com PKCE.
 *
 * **Nada aqui conhece um assistente pelo nome.** Cliente novo se registra
 * sozinho; lista de "clientes aceitos" faria o conector parar no dia em que um
 * deles mudasse o endereço de retorno.
 *
 * O que grava e consulta fica em `mcp-conexoes.ts`. Ver docs/MCP.md.
 */

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

/** Em produção é sempre https; `localhost` é o desenvolvimento. */
export function emissor(): string {
  return `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) ? "http" : "https"}://${BASE}`;
}

export const CAMINHO_DO_RECURSO = "/api/mcp";

export function recurso(): string {
  return `${emissor()}${CAMINHO_DO_RECURSO}`;
}

/** Um escopo só: a conexão age como a loja, igual à chave do conector. */
export const ESCOPO_MCP = "loja";

export const VALIDADE = {
  /** O pedido de autorização, enquanto o lojista entra e lê a tela. */
  pedidoMs: 10 * 60_000,
  codigoMs: 5 * 60_000,
  acessoMs: 60 * 60_000,
  /** Renovado a cada uso: só vence conexão parada há dois meses. */
  renovacaoMs: 60 * 86_400_000,
} as const;

// ── Metadados de descoberta ────────────────────────────────────────────

export function metadadosDoRecurso() {
  return {
    resource: recurso(),
    authorization_servers: [emissor()],
    bearer_methods_supported: ["header"],
    scopes_supported: [ESCOPO_MCP],
    resource_name: "Lojas por Avila Ops",
    resource_documentation: `${emissor()}/developers`,
  };
}

export function metadadosDoServidor() {
  const e = emissor();
  return {
    issuer: e,
    authorization_endpoint: `${e}/oauth/authorize`,
    token_endpoint: `${e}/oauth/token`,
    registration_endpoint: `${e}/oauth/register`,
    revocation_endpoint: `${e}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    // Cliente público: assistente no computador ou no celular do lojista não
    // guarda segredo. Quem prova a posse do código é o PKCE.
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [ESCOPO_MCP],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${e}/developers`,
  };
}

/** O cabeçalho que diz ao assistente onde começa o login. */
export function desafioDeAutenticacao(erro?: "invalid_token"): string {
  const partes = [`Bearer resource_metadata="${emissor()}/.well-known/oauth-protected-resource"`];
  if (erro) partes.push(`error="${erro}"`);
  return partes.join(", ");
}

// ── Endereço de retorno ────────────────────────────────────────────────

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * `https` em qualquer host, ou `http` só na própria máquina (é como o Codex e o
 * Claude Code recebem o código, numa porta local). Sem fragmento, sem usuário.
 *
 * Esquema próprio de aplicativo (`cursor://`, `vscode://`) também vale: é o
 * retorno de cliente instalado. `javascript:` e `data:` não são retorno de
 * ninguém, e redirecionar para eles executaria código na nossa origem.
 */
export function retornoValido(uri: string): boolean {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return Boolean(u.hostname);
  if (u.protocol === "http:") return HOSTS_LOCAIS.has(u.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["javascript:", "data:", "vbscript:", "file:", "blob:", "about:"].includes(u.protocol);
}

function ehLocal(u: URL): boolean {
  return u.protocol === "http:" && HOSTS_LOCAIS.has(u.hostname);
}

/**
 * O retorno pedido é um dos registrados?
 *
 * Comparação exata, com uma exceção da RFC 8252: em retorno local a porta é
 * sorteada a cada login, então ela não entra na comparação.
 */
export function retornoRegistrado(pedido: string, registrados: readonly string[]): boolean {
  if (!retornoValido(pedido)) return false;
  if (registrados.includes(pedido)) return true;
  const p = new URL(pedido);
  if (!ehLocal(p)) return false;
  return registrados.some((r) => {
    const u = new URL(r);
    return ehLocal(u) && u.hostname === p.hostname && u.pathname === p.pathname && u.search === p.search;
  });
}

// ── Registro de cliente ────────────────────────────────────────────────

export interface ClienteParaRegistrar {
  nome: string;
  retornos: string[];
}

/**
 * Lê o pedido de registro (RFC 7591). O nome é só o que o lojista vai ler na
 * tela de autorização: cortado em 80 caracteres e sem quebra de linha, porque
 * quem o escolhe é o cliente, não nós.
 */
export function lerRegistro(corpo: unknown): { cliente: ClienteParaRegistrar } | { erro: string; descricao: string } {
  const c = corpo && typeof corpo === "object" && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : {};
  const retornos = Array.isArray(c.redirect_uris) ? c.redirect_uris : [];
  if (retornos.length === 0 || retornos.length > 10 || !retornos.every((r): r is string => typeof r === "string" && retornoValido(r))) {
    return { erro: "invalid_redirect_uri", descricao: "Informe de 1 a 10 redirect_uris em https, ou http em localhost." };
  }
  const metodo = c.token_endpoint_auth_method;
  if (metodo !== undefined && metodo !== "none") {
    return { erro: "invalid_client_metadata", descricao: "Só cliente público: token_endpoint_auth_method deve ser none." };
  }
  const nome = (typeof c.client_name === "string" ? c.client_name : "").replace(/\s+/g, " ").trim().slice(0, 80);
  return { cliente: { nome: nome || "Assistente de IA", retornos: [...new Set(retornos)] } };
}

export function respostaDoRegistro(c: { id: string; nome: string; retornos: string[]; criadoEm: Date }) {
  return {
    client_id: c.id,
    client_id_issued_at: Math.floor(c.criadoEm.getTime() / 1000),
    client_name: c.nome,
    redirect_uris: c.retornos,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

// ── PKCE ───────────────────────────────────────────────────────────────

export function desafioValido(desafio: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(desafio);
}

/** O verificador apresentado na troca bate com o desafio guardado no pedido? */
export function pkceConfere(verificador: string, desafio: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verificador)) return false;
  const calculado = createHash("sha256").update(verificador).digest("base64url");
  return calculado.length === desafio.length && timingSafeEqual(Buffer.from(calculado), Buffer.from(desafio));
}

// ── Pedido de autorização ──────────────────────────────────────────────

export interface PedidoDeAutorizacao {
  clienteId: string;
  retorno: string;
  desafio: string;
  state: string | null;
}

export type LeituraDoPedido =
  | { tipo: "ok"; pedido: PedidoDeAutorizacao }
  /** Não dá para confiar no retorno: o erro aparece na nossa tela. */
  | { tipo: "recusar"; motivo: string }
  /** O retorno é do cliente: o erro volta para ele, como manda a RFC 6749. */
  | { tipo: "devolver"; retorno: string; erro: string; descricao: string; state: string | null };

/**
 * Confere o que chegou em `/oauth/authorize`.
 *
 * A ordem importa: enquanto cliente e retorno não estiverem conferidos, nenhum
 * erro é redirecionado. Devolver erro a um retorno não registrado faria da
 * nossa rota um redirecionador aberto com o nosso domínio na frente.
 */
export function lerPedido(p: URLSearchParams, cliente: { id: string; retornos: readonly string[] } | null): LeituraDoPedido {
  if (!cliente) return { tipo: "recusar", motivo: "Este assistente não está registrado. Remova o conector e adicione de novo." };
  const retorno = p.get("redirect_uri") ?? (cliente.retornos.length === 1 ? cliente.retornos[0] : "");
  if (!retornoRegistrado(retorno, cliente.retornos)) {
    return { tipo: "recusar", motivo: "O endereço de retorno não confere com o que o assistente registrou." };
  }
  const state = p.get("state");
  const devolver = (erro: string, descricao: string): LeituraDoPedido => ({ tipo: "devolver", retorno, erro, descricao, state });

  if (p.get("response_type") !== "code") return devolver("unsupported_response_type", "Use response_type=code.");
  const desafio = p.get("code_challenge") ?? "";
  if (!desafioValido(desafio) || (p.get("code_challenge_method") ?? "") !== "S256") {
    return devolver("invalid_request", "PKCE obrigatório: code_challenge com code_challenge_method=S256.");
  }
  const alvo = p.get("resource");
  if (alvo && !mesmoRecurso(alvo)) return devolver("invalid_target", `Este servidor só autoriza ${recurso()}.`);

  return { tipo: "ok", pedido: { clienteId: cliente.id, retorno, desafio, state } };
}

/** `resource` pode vir com barra no fim ou só com a origem; os dois apontam para cá. */
export function mesmoRecurso(alvo: string): boolean {
  const limpo = alvo.replace(/\/+$/, "");
  return limpo === recurso() || limpo === emissor();
}

/** Para onde o lojista volta depois de decidir. */
export function urlDeRetorno(retorno: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(retorno);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

// ── Pedido em trânsito (cookie) ────────────────────────────────────────

function segredo(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LOJAS_SECRET ausente.");
  return Buffer.from(hex, "hex");
}

/** O propósito separa esta assinatura da sessão e do `state`, que usam a mesma chave. */
function assinar(corpo: string): string {
  return createHmac("sha256", segredo()).update(`mcp-pedido:${corpo}`).digest("base64url");
}

export const COOKIE_DO_PEDIDO = "lojas_mcp_pedido";

/**
 * O pedido viaja assinado entre `/oauth/authorize` e a tela de autorização,
 * passando pelo login se preciso. Assinado porque a tela confia nele para dizer
 * ao lojista quem está pedindo acesso e para onde o código vai.
 */
export function selarPedido(pedido: PedidoDeAutorizacao, agora = Date.now()): string {
  const corpo = Buffer.from(JSON.stringify({ ...pedido, exp: agora + VALIDADE.pedidoMs })).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function abrirPedido(selado: string | null | undefined, agora = Date.now()): PedidoDeAutorizacao | null {
  const [corpo, assinatura] = (selado ?? "").split(".");
  if (!corpo || !assinatura) return null;
  const esperada = assinar(corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Partial<PedidoDeAutorizacao> & { exp?: number };
    if (typeof d.exp !== "number" || d.exp <= agora) return null;
    if (typeof d.clienteId !== "string" || typeof d.retorno !== "string" || typeof d.desafio !== "string") return null;
    return { clienteId: d.clienteId, retorno: d.retorno, desafio: d.desafio, state: typeof d.state === "string" ? d.state : null };
  } catch {
    return null;
  }
}

// ── Códigos e tokens ───────────────────────────────────────────────────

export const PREFIXO = { codigo: "lojas_ac_", acesso: "lojas_at_", renovacao: "lojas_rt_" } as const;

export type TipoDeSegredo = keyof typeof PREFIXO;

/** 160 bits de acaso. Guardamos só o sha256: banco vazado não entrega conexão. */
export function gerarSegredo(tipo: TipoDeSegredo): { valor: string; hash: string } {
  const valor = `${PREFIXO[tipo]}${randomBytes(20).toString("hex")}`;
  return { valor, hash: hashDoSegredo(valor) };
}

export function hashDoSegredo(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export function pareceSegredo(tipo: TipoDeSegredo, valor: string): boolean {
  return new RegExp(`^${PREFIXO[tipo]}[0-9a-f]{40}$`).test(valor);
}

export function respostaDeToken(acesso: string, renovacao: string) {
  return {
    access_token: acesso,
    token_type: "Bearer",
    expires_in: Math.floor(VALIDADE.acessoMs / 1000),
    refresh_token: renovacao,
    scope: ESCOPO_MCP,
  };
}
