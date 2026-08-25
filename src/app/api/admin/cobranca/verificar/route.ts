import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { verificarInadimplencia } from "@/lib/assinatura";

/** POST — rotina diária (n8n Schedule → aqui): suspende lojas inadimplentes. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await verificarInadimplencia());
}
