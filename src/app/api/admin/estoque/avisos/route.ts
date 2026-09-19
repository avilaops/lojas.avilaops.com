import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { avisarQuemEsperava } from "@/lib/estoque-avisos";

/** POST — disparo manual; o agendamento é da rotina `estoque.avisos`. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await avisarQuemEsperava());
}
