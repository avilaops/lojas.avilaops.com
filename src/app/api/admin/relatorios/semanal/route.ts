import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { emitirRelatoriosSemanais } from "@/lib/relatorio";

/** POST — disparo manual; o agendamento é da rotina `relatorios.semanal`. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await emitirRelatoriosSemanais());
}
