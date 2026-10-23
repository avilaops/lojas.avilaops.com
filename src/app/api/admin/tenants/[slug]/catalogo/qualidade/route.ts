import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { INCLUIR_CATALOGO } from "@/lib/catalogo-qualidade";
import { relatorioDeGovernanca } from "@/lib/catalogo-governanca";
import { prisma } from "@/lib/db";

type Contexto = { params: Promise<{ slug: string }> };

/** Relatório completo e somente leitura para operação e automações. */
export async function GET(request: Request, { params }: Contexto) {
  if (!autorizado(request)) return naoAutorizado();

  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) return Response.json({ erro: "Loja não encontrada." }, { status: 404 });

  const produtos = await prisma.produto.findMany({
    where: { tenantId: tenant.id },
    include: INCLUIR_CATALOGO,
    orderBy: { id: "asc" },
  });

  return Response.json(relatorioDeGovernanca(produtos));
}
