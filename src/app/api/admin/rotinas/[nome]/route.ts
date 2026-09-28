import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ehNomeDeRotina } from "@/lib/rotinas";
import { forcarRotina } from "@/lib/rotinas-executor";

/**
 * POST /api/admin/rotinas/:nome — roda a rotina agora, fora do horário.
 *
 * O agendamento é do agendador interno; isto é o "rodar agora" da operação,
 * para não precisar esperar a hora depois de consertar alguma coisa. A trava
 * continua valendo: apertar duas vezes não coloca duas execuções no ar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ nome: string }> }) {
  if (!autorizado(request)) return naoAutorizado();
  const { nome } = await params;
  if (!ehNomeDeRotina(nome)) return Response.json({ erro: "rotina desconhecida" }, { status: 404 });
  const resultado = await forcarRotina(nome);
  if (!resultado) return Response.json({ erro: "rotina já está em execução" }, { status: 409 });
  return Response.json(resultado, { status: resultado.erro ? 500 : 200 });
}
