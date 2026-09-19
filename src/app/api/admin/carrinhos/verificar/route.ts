import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { verificarCarrinhosAbandonados } from "@/lib/carrinhos";

/** POST — disparo manual; o agendamento é da rotina `carrinhos.verificar`. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await verificarCarrinhosAbandonados());
}
