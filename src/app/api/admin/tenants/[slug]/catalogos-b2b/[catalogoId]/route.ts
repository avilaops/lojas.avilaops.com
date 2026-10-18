import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { obterCatalogoB2B } from "@/lib/catalogo-b2b";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string; catalogoId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, catalogoId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  try {
    return Response.json(await obterCatalogoB2B(tenant.id, catalogoId));
  } catch {
    return Response.json({ erro: "catálogo não encontrado" }, { status: 404 });
  }
}
