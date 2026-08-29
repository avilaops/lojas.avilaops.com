import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ eventId: string }> };

/** GET — estado de um evento (depuração: "o n8n chegou a executar isso?"). */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { eventId } = await params;
  const e = await prisma.automacaoEvento.findUnique({ where: { eventId } });
  if (!e) return Response.json({ erro: "evento não encontrado" }, { status: 404 });
  return Response.json(e);
}

const Schema = z.object({
  status: z.enum(["PROCESSADO", "FALHOU", "IGNORADO"]),
  detalhe: z.string().max(500).optional(),
});

/** PATCH — o n8n fecha o ciclo no fim do fluxo: PROCESSADO, FALHOU ou IGNORADO. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { eventId } = await params;
  const r = Schema.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });
  try {
    const e = await prisma.automacaoEvento.update({
      where: { eventId },
      data: { status: r.data.status, detalhe: r.data.detalhe ?? null, concluidoEm: new Date() },
    });
    return Response.json({ eventId: e.eventId, status: e.status });
  } catch {
    return Response.json({ erro: "evento não encontrado" }, { status: 404 });
  }
}
