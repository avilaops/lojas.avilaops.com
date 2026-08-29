import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

const Filtro = z.object({
  status: z.enum(["EMITIDO", "PROCESSANDO", "PROCESSADO", "FALHOU", "IGNORADO"]).optional(),
  slug: z.string().min(1).max(80).optional(),
  tipo: z.string().min(1).max(80).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100),
});

/**
 * GET — últimos eventos emitidos ao n8n, com filtros por status/loja/tipo.
 * Responde "o que a plataforma emitiu e o que o n8n fez com isso" sem abrir
 * o n8n: `?status=FALHOU` é a fila do que precisa de olho humano.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const url = new URL(request.url);
  const r = Filtro.safeParse(Object.fromEntries(url.searchParams));
  if (!r.success) return Response.json({ erro: "filtro inválido", detalhes: r.error.flatten() }, { status: 422 });
  const { status, slug, tipo, limite } = r.data;
  const eventos = await prisma.automacaoEvento.findMany({
    where: { ...(status ? { status } : {}), ...(slug ? { slug } : {}), ...(tipo ? { tipo } : {}) },
    orderBy: { emitidoEm: "desc" },
    take: limite,
  });
  const porStatus = await prisma.automacaoEvento.groupBy({ by: ["status"], _count: { _all: true } });
  return Response.json({ eventos, totais: Object.fromEntries(porStatus.map((g) => [g.status, g._count._all])) });
}
