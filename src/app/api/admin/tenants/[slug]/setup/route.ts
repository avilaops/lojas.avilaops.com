import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ slug: string }> };

/** POST — marca o setup (R$ 497) como pago; DELETE — desmarca. Uso da Avila Ops/n8n. */
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  try {
    const t = await prisma.tenant.update({ where: { slug }, data: { setupPagoEm: new Date() } });
    return Response.json({ slug: t.slug, setupPagoEm: t.setupPagoEm });
  } catch {
    return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  try {
    const t = await prisma.tenant.update({ where: { slug }, data: { setupPagoEm: null } });
    return Response.json({ slug: t.slug, setupPagoEm: null });
  } catch {
    return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  }
}
