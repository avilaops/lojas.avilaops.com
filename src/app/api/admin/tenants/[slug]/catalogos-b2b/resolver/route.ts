import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { resolverCatalogoB2B } from "@/lib/catalogo-b2b";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };
const Entrada = z.object({
  empresaId: z.string().min(1),
  unidadeId: z.string().min(1).nullable(),
  produtoId: z.string().min(1),
  varianteId: z.string().min(1).nullable(),
  quantidade: z.number().int().positive(),
  agora: z.string().datetime().transform((valor) => new Date(valor)).optional(),
}).strict();

export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "dados inválidos", detalhes: entrada.error.flatten() }, { status: 422 });
  try {
    return Response.json(await resolverCatalogoB2B(tenant.id, { ...entrada.data, agora: entrada.data.agora ?? new Date() }));
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "não foi possível resolver" }, { status: 422 });
  }
}
