import { LimitadorPorJanela, cabecalhosDoLimite } from "@/lib/api-limite";
import { autenticarMcp, McpAuthError, type McpAuthResult } from "@/lib/mcp-auth";
import { registrarChamada } from "@/lib/mcp-historico";
import { desafioDeAutenticacao, recurso } from "@/lib/mcp-oauth";
import { CORS } from "@/lib/mcp-oauth-http";
import { anotacoes, FERRAMENTAS, podeUsar } from "@/lib/mcp-permissoes";
import { ehNotificacao, erroRpc, negociarVersao } from "@/lib/mcp-protocolo";
import { MCP_TOOLS } from "@/lib/mcp-tools";
import { hostDoSlug, registrarSemDerrubar } from "@/lib/metricas-rota";
import { HOST_SEM_LOJA } from "@/lib/metricas-tenant";

const SERVER_INFO = {
  name: "avilaops-lojas-mcp",
  title: "Lojas por Avila Ops",
  version: "1.2.0",
};

const INSTRUCOES =
  "Conector da loja do lojista na plataforma Lojas por Avila Ops. As ferramentas leem e alteram a loja de verdade: " +
  "catálogo, preços, estoque, pedidos, cupons e clientes. Valores em reais; confirme com o lojista antes de alterar preço, estoque ou status de pedido. " +
  "Você só vê as ferramentas que o lojista autorizou para esta conexão.";

/** O navegador precisa enxergar o cabeçalho que diz onde fazer login. */
const CABECALHOS = { ...CORS, "access-control-expose-headers": "www-authenticate, ratelimit-limit, ratelimit-remaining, ratelimit-reset" };

/**
 * Por minuto, por credencial: o mesmo teto da chave secreta na API. Um
 * assistente em conversa fica longe disso; quem bate aqui é laço.
 */
const LIMITE_POR_MINUTO = 120;
const limitador = new LimitadorPorJanela();

function json(corpo: unknown, status = 200, extras: Record<string, string> = {}): Response {
  return Response.json(corpo, { status, headers: { ...CABECALHOS, ...extras } });
}

/**
 * Endpoint MCP (Streamable HTTP, só requisição e resposta): Claude, ChatGPT,
 * Codex, Cursor e agentes n8n. URL: https://lojas.avilaops.com/api/mcp
 *
 * Toda mensagem exige autorização, inclusive o aperto de mão: é o 401 com
 * `WWW-Authenticate` que faz o assistente abrir o login do conector. Ver
 * docs/MCP.md.
 */
export async function POST(request: Request) {
  // A loja vem da credencial, não do host: até autenticar, a métrica não tem de quem ser.
  const inicio = performance.now();
  let hostDaLoja: string = HOST_SEM_LOJA;
  const medida = (resposta: Response): Response => {
    registrarSemDerrubar({ host: hostDaLoja, grupo: "mcp", status: resposta.status, duracaoMs: performance.now() - inicio });
    return resposta;
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return medida(json(erroRpc(null, -32700, "Parse error"), 400));
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return medida(json(erroRpc(null, -32600, "Invalid Request"), 400));
  }
  const requisicao = body as { id?: unknown; method?: unknown; params?: unknown };
  const id = requisicao.id ?? null;
  const method = requisicao.method;
  const params = requisicao.params && typeof requisicao.params === "object" && !Array.isArray(requisicao.params)
    ? requisicao.params as { name?: unknown; arguments?: unknown; protocolVersion?: unknown }
    : {};
  if (typeof method !== "string") {
    // Resposta ou mensagem sem método: nada a fazer com ela.
    return medida(requisicao.id === undefined ? new Response(null, { status: 202, headers: CABECALHOS }) : json(erroRpc(id, -32600, "Invalid Request"), 400));
  }

  let auth: McpAuthResult;
  try {
    auth = await autenticarMcp(request);
  } catch (err: unknown) {
    if (!(err instanceof McpAuthError)) throw err;
    const corpo = {
      ...erroRpc(id, err.statusCode === 401 ? -32001 : -32002, err.message),
      ...(err.upgradeRequired ? { upgradeNecessario: true, planoNecessario: "LOJA_PRO" } : {}),
    };
    // Sem credencial nenhuma, o desafio vai liso: é o primeiro passo do login,
    // não um erro. `invalid_token` avisa o assistente de que o token que ele
    // tem não serve mais e é hora de renovar ou autorizar de novo.
    const semCredencial = !request.headers.get("authorization") && !request.headers.get("x-api-key");
    return medida(
      err.statusCode === 401
        ? json(corpo, 401, { "www-authenticate": desafioDeAutenticacao(semCredencial ? undefined : "invalid_token") })
        : json(corpo, err.statusCode),
    );
  }

  let doLimite: Record<string, string> = {};
  if (auth.tipo === "loja") {
    hostDaLoja = hostDoSlug(auth.tenant.slug) ?? HOST_SEM_LOJA;
    const limite = limitador.consumir(`${auth.origem.tipo}:${auth.origem.id}`, LIMITE_POR_MINUTO);
    doLimite = cabecalhosDoLimite(limite);
    if (!limite.permitido) {
      return medida(json(erroRpc(id, -32003, `Limite de ${limite.limite} chamadas por minuto atingido. Tente de novo em ${limite.reiniciaEm} s.`), 429, {
        ...doLimite,
        "retry-after": String(limite.reiniciaEm),
      }));
    }
  }
  const responder = (corpo: unknown) => medida(json(corpo, 200, doLimite));

  // Notificação não se responde (`notifications/initialized`, `notifications/cancelled`).
  if (ehNotificacao(requisicao)) return medida(new Response(null, { status: 202, headers: CABECALHOS }));

  // 1. Inicialização
  if (method === "initialize") {
    return responder({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: negociarVersao(params.protocolVersion),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCOES,
      },
    });
  }

  // 2. Ping
  if (method === "ping") {
    return responder({ jsonrpc: "2.0", id, result: {} });
  }

  // 3. Listar Ferramentas: só as que esta credencial pode usar. O assistente
  // não oferece ao lojista o que a conexão recusaria.
  if (method === "tools/list") {
    const visiveis = auth.tipo === "loja" ? MCP_TOOLS.filter((t) => podeUsar(auth.escopos, t.name)) : MCP_TOOLS;
    return responder({
      jsonrpc: "2.0",
      id,
      result: {
        tools: visiveis.map((t) => ({
          name: t.name,
          title: anotacoes(t.name).title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: anotacoes(t.name),
        })),
      },
    });
  }

  // 4. Executar Ferramenta
  if (method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name : "";
    const toolArgs = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {};

    const tool = MCP_TOOLS.find((t) => t.name === toolName);
    if (!tool) return responder(erroRpc(id, -32602, `Ferramenta não encontrada: ${toolName}`));

    const comoTexto = (resultado: unknown, isError = false) =>
      responder({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2) }],
          ...(isError ? { isError: true } : {}),
        },
      });

    if (auth.tipo !== "loja") return comoTexto({ erro: "Chave de admin não vinculada a uma loja específica." }, true);

    if (!podeUsar(auth.escopos, tool.name)) {
      const escopo = FERRAMENTAS[tool.name]?.escopo;
      return comoTexto({
        erro: `Esta conexão não tem permissão para "${anotacoes(tool.name).title}".`,
        permissaoNecessaria: escopo,
        comoResolver: auth.origem.tipo === "conexao"
          ? "O lojista pode desconectar em Painel, IA e API, e conectar de novo marcando esta área."
          : "Crie no painel uma chave secreta com este escopo.",
      }, true);
    }

    const comeco = performance.now();
    const anotar = (ok: boolean) =>
      registrarChamada({ tenantId: auth.tenant.id, origem: auth.origem, ferramenta: tool.name, args: toolArgs, ok, duracaoMs: performance.now() - comeco });

    try {
      const resultado = await tool.handler(toolArgs, { tenant: auth.tenant, isAdmin: false });
      await anotar(true);
      return comoTexto(resultado);
    } catch (err: unknown) {
      // Erro da ferramenta volta como resultado, para o assistente ler e corrigir
      // os argumentos; erro de protocolo é só o que o cliente fez errado.
      await anotar(false);
      return comoTexto({ erro: err instanceof Error ? err.message : String(err) }, true);
    }
  }

  return responder(erroRpc(id, -32601, `Método não suportado: ${method}`));
}

/**
 * Sem fluxo de eventos: o servidor só responde ao que é pedido. Cliente que
 * tenta abrir um (`Accept: text/event-stream`) recebe 405, que é o sinal da
 * especificação para seguir só com POST. No navegador, mostra o que é isto.
 */
export async function GET(request: Request) {
  if ((request.headers.get("accept") ?? "").includes("text/event-stream")) {
    return new Response(null, { status: 405, headers: { ...CABECALHOS, allow: "POST, OPTIONS" } });
  }
  return json({
    status: "online",
    server: SERVER_INFO.name,
    version: SERVER_INFO.version,
    endpoint: recurso(),
    doc: "Conector MCP das Lojas por Avila Ops. Adicione este endereço como conector no seu assistente (Claude, ChatGPT, Codex) e autorize a loja pelo login. Exclusivo do plano Loja Pro.",
  });
}

/** Não há sessão de protocolo para encerrar. */
export function DELETE() {
  return new Response(null, { status: 405, headers: { ...CABECALHOS, allow: "POST, OPTIONS" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CABECALHOS, "access-control-max-age": "86400" } });
}
