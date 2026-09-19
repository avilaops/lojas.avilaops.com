import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { emitirRelatoriosSemanais } from "@/lib/relatorio";

/**
 * POST — disparo manual; o agendamento é da rotina `relatorios.semanal`.
 *
 * Loja que já recebeu o relatório desta semana volta em `jaEnviados` e não
 * recebe outro e-mail: apertar de novo não custa nada a quem lê.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await emitirRelatoriosSemanais());
}
