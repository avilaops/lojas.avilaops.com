import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { aprovarVersaoCatalogoB2B } from "@/lib/catalogo-b2b";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string; catalogoId: string }> };
const Entrada = z.object({ versao: z.number().int().positive(), ator: z.string().trim().min(1).max(254) }).strict();

export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, catalogoId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const catalogo = await prisma.catalogoB2B.findFirst({ where: { tenantId: tenant.id, id: catalogoId }, select: { id: true } });
  if (!catalogo) return Response.json({ erro: "catálogo não encontrado" }, { status: 404 });
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "dados inválidos", detalhes: entrada.error.flatten() }, { status: 422 });
  try {
    return Response.json(await aprovarVersaoCatalogoB2B(tenant.id, catalogo.id, entrada.data.versao, entrada.data.ator));
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "não foi possível aprovar" }, { status: 422 });
  }
}
