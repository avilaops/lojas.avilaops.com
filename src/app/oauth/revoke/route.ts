import { revogarPorToken } from "@/lib/mcp-conexoes";
import { jsonSemCache, naoExiste, noDominioBase, preflight } from "@/lib/mcp-oauth-http";
import { medirRota } from "@/lib/metricas-rota";

/**
 * O assistente desfaz a própria conexão (RFC 7009), quando o lojista remove o
 * conector por lá. Responde 200 mesmo para token desconhecido: a resposta não
 * pode servir para testar se um token existe.
 */
export const POST = medirRota("mcp", revogar, { host: () => null });

async function revogar(request: Request) {
  if (!noDominioBase(request)) return naoExiste();
  const token = new URLSearchParams(await request.text().catch(() => "")).get("token") ?? "";
  if (token) await revogarPorToken(token);
  return jsonSemCache({});
}

export const OPTIONS = preflight;
