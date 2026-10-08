import { metadadosDoRecurso } from "@/lib/mcp-oauth";
import { CORS, naoExiste, noDominioBase, preflight } from "@/lib/mcp-oauth-http";

export const dynamic = "force-dynamic";

/**
 * Onde o assistente descobre quem autoriza o conector (RFC 9728).
 *
 * O `[[...resto]]` atende também `/.well-known/oauth-protected-resource/api/mcp`:
 * a especificação manda o cliente tentar com o caminho do recurso antes da raiz.
 */
export function GET(request: Request) {
  if (!noDominioBase(request)) return naoExiste();
  return Response.json(metadadosDoRecurso(), { headers: { ...CORS, "cache-control": "public, max-age=300" } });
}

export const OPTIONS = preflight;
