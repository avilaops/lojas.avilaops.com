import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { emitirRelatoriosSemanais } from "@/lib/relatorio";

/** POST — segunda-feira (n8n): um evento `loja.relatorio-semanal` por loja com movimento. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await emitirRelatoriosSemanais());
}
