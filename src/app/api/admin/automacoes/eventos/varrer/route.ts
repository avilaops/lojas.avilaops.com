import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

/**
 * POST — varredura de eventos presos (rotina horária do n8n).
 *
 * Dois jeitos de um evento nunca fechar o ciclo:
 * - EMITIDO sem reivindicação: o n8n não recebeu (fora do ar, token errado,
 *   timeout dos 5 s). Depois de 15 min não vai mais chegar.
 * - PROCESSANDO há dias: a execução morreu no meio. O limite é largo (5 dias)
 *   porque há ramos legítimos dormindo 3 dias no Wait.
 *
 * Os dois viram FALHOU com o motivo em `detalhe`; nada é reenviado daqui —
 * reemitir é decisão humana, com a lista em GET ?status=FALHOU.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const agora = Date.now();
  const naoEntregues = await prisma.automacaoEvento.updateMany({
    // Os `mercadolivre.*` são a fila de ENTRADA, consumida pela rotina de
    // avisos e não pelo n8n: marcá-los como "n8n não reivindicou" tirava da
    // fila um pedido do canal só porque a rotina atrasou.
    where: { status: "EMITIDO", emitidoEm: { lt: new Date(agora - 15 * 60_000) }, NOT: { tipo: { startsWith: "mercadolivre." } } },
    data: { status: "FALHOU", detalhe: "n8n não reivindicou em 15 min", concluidoEm: new Date() },
  });
  const presos = await prisma.automacaoEvento.updateMany({
    where: { status: "PROCESSANDO", reivindicadoEm: { lt: new Date(agora - 5 * 24 * 3_600_000) } },
    data: { status: "FALHOU", detalhe: "execução não encerrou em 5 dias", concluidoEm: new Date() },
  });
  return Response.json({ naoEntregues: naoEntregues.count, presos: presos.count });
}
