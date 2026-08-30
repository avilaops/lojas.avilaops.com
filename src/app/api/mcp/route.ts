import { autenticarMcp, McpAuthError } from "@/lib/mcp-auth";
import { MCP_TOOLS } from "@/lib/mcp-tools";

const SERVER_INFO = {
  name: "avilaops-lojas-mcp",
  version: "1.0.0",
  description: "Servidor MCP oficial das Lojas Ávila Ops: e-commerce nativo com IA",
};

/**
 * Endpoint MCP compatível com Claude (Desktop, Mobile, Web), Cursor, Antigravity e Agentes n8n.
 * URL: https://lojas.avilaops.com/api/mcp
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }, { status: 400 });
  }
  const requisicao = body as { id?: unknown; method?: unknown; params?: unknown };
  const id = requisicao.id ?? null;
  const method = requisicao.method;
  const params = requisicao.params && typeof requisicao.params === "object" && !Array.isArray(requisicao.params)
    ? requisicao.params as { name?: unknown; arguments?: unknown }
    : {};
  if (typeof method !== "string") {
    return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code: -32600, message: "Invalid Request" } }, { status: 400 });
  }

  // 1. Inicialização (não exige autenticação)
  if (method === "initialize") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
  }

  // 2. Ping
  if (method === "ping") {
    return Response.json({ jsonrpc: "2.0", id, result: {} });
  }

  // 3. Listar Ferramentas
  if (method === "tools/list") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    });
  }

  // 4. Executar Ferramenta (Exige Autenticação e Plano Loja Pro)
  if (method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name : "";
    const toolArgs = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {};

    const tool = MCP_TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      return Response.json(
        { jsonrpc: "2.0", id, error: { code: -32602, message: `Ferramenta não encontrada: ${toolName}` } },
        { status: 404 },
      );
    }

    try {
      const auth = await autenticarMcp(request);
      if (auth.tipo === "loja") {
        const resultado = await tool.handler(toolArgs, { tenant: auth.tenant, isAdmin: false });
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2) }],
          },
        });
      } else {
        // Admin
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify({ erro: "Chave de admin não vinculada a uma loja específica." }, null, 2) }],
            isError: true,
          },
        });
      }
    } catch (err: unknown) {
      if (err instanceof McpAuthError) {
        return Response.json(
          {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      erro: err.message,
                      upgradeNecessario: err.upgradeRequired,
                      planoNecessario: "LOJA_PRO",
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            },
          },
          { status: err.statusCode },
        );
      }

      return Response.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify({ erro: err instanceof Error ? err.message : String(err) }, null, 2) }],
          isError: true,
        },
      });
    }
  }

  return Response.json(
    { jsonrpc: "2.0", id, error: { code: -32601, message: `Método não suportado: ${method}` } },
    { status: 400 },
  );
}

export async function GET() {
  return Response.json({
    status: "online",
    server: SERVER_INFO.name,
    version: SERVER_INFO.version,
    endpoint: "https://lojas.avilaops.com/api/mcp",
    doc: "Conector MCP Oficial das Lojas Ávila Ops. Autentique via Header 'Authorization: Bearer lojas_live_<slug>_<token>'. Exclusivo para o plano Loja Pro.",
  });
}
