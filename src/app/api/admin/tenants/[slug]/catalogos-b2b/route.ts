import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { obterCatalogoB2B, salvarCatalogoB2B } from "@/lib/catalogo-b2b";
import { EntradaCatalogoB2BSchema } from "@/lib/catalogo-b2b-schema";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const catalogos = await prisma.catalogoB2B.findMany({
    where: { tenantId: tenant.id },
    include: { versoes: { select: { id: true, versao: true, estado: true, moeda: true, vigenteDesde: true, vigenteAte: true, aprovadoEm: true, aprovadoPor: true, conteudoHash: true }, orderBy: { versao: "desc" } } },
    orderBy: { referencia: "asc" },
  });
  return Response.json({ catalogos });
}

export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const resultado = EntradaCatalogoB2BSchema.safeParse(await request.json().catch(() => null));
  if (!resultado.success) return Response.json({ erro: "dados inválidos", detalhes: resultado.error.flatten() }, { status: 422 });
  try {
    const catalogo = await salvarCatalogoB2B(tenant.id, resultado.data);
    return Response.json(await obterCatalogoB2B(tenant.id, catalogo.id), { status: 201 });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "catálogo inconsistente" }, { status: 422 });
  }
}
