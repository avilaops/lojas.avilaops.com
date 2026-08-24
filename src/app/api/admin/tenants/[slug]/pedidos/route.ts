import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ slug: string }> };

/** GET — pedidos da loja (painel do lojista no portal lê daqui). */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const pedidos = await prisma.pedido.findMany({ where: { tenantId: t.id }, include: { itens: true }, orderBy: { criadoEm: "desc" }, take: 200 });
  return Response.json(pedidos);
}
