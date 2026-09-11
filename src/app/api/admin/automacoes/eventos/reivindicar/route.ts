import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

/**
 * POST — o n8n reivindica um evento antes de qualquer efeito externo.
 *
 * Primeira entrega: EMITIDO → PROCESSANDO e `{ duplicado: false }`.
 * Entrega repetida (ou execução reprocessada): `{ duplicado: true }` e o fluxo
 * para ali. Evento que a plataforma não chegou a registrar (banco fora na
 * hora de emitir) é criado aqui já como PROCESSANDO: a trava continua valendo
 * para a próxima entrega.
 *
 * A troca de estado é um único UPDATE condicional — duas entregas simultâneas
 * do mesmo eventId nunca passam as duas.
 */
const Schema = z.object({
  eventId: z.string().min(8).max(80),
  tipo: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  versao: z.coerce.number().int().min(1).default(1),
  correlationId: z.string().max(120).nullable().optional(),
});

export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const r = Schema.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });
  const { eventId, tipo, slug, versao, correlationId } = r.data;
  const agora = new Date();

  const virou = await prisma.automacaoEvento.updateMany({
    where: { eventId, status: "EMITIDO" },
    data: { status: "PROCESSANDO", reivindicadoEm: agora },
  });
  if (virou.count === 1) return Response.json({ eventId, duplicado: false });

  try {
    await prisma.automacaoEvento.create({ data: { eventId, tipo, slug, versao, status: "PROCESSANDO", reivindicadoEm: agora, correlationId: correlationId ?? null } });
    return Response.json({ eventId, duplicado: false, registradoAgora: true });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      const existente = await prisma.automacaoEvento.findUnique({ where: { eventId }, select: { status: true, reivindicadoEm: true } });
      return Response.json({ eventId, duplicado: true, status: existente?.status, reivindicadoEm: existente?.reivindicadoEm });
    }
    throw erro;
  }
}
