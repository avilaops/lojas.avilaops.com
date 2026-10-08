import { metadadosDoServidor } from "@/lib/mcp-oauth";
import { CORS, naoExiste, noDominioBase, preflight } from "@/lib/mcp-oauth-http";

export const dynamic = "force-dynamic";

/** Os endereços do login do conector (RFC 8414). */
export function GET(request: Request) {
  if (!noDominioBase(request)) return naoExiste();
  return Response.json(metadadosDoServidor(), { headers: { ...CORS, "cache-control": "public, max-age=300" } });
}

export const OPTIONS = preflight;
