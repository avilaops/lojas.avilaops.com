import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { verificarInadimplencia } from "@/lib/assinatura";

/** POST — disparo manual; o agendamento é da rotina `cobranca.verificar`. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await verificarInadimplencia());
}
