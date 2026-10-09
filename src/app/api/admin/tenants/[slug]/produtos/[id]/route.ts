import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ slug: string; id: string }> };

/**
 * GET — um produto da loja, com o histórico das últimas alterações.
 *
 * Para o painel da Ávila Ops abrir a ficha sem carregar o catálogo inteiro. O
 * histórico vem de `HistoricoCatalogo`, que a própria plataforma grava a cada
 * mudança (origem, campos, antes e depois): é leitura, este endpoint não
 * altera nada. A busca é sempre por loja E id — id de produto de outra loja
 * devolve 404, não o produto.
 */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, id } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const produto = await prisma.produto.findFirst({
    where: { tenantId: t.id, id },
    include: { categoria: { select: { nome: true, slug: true } } },
  });
  if (!produto) return Response.json({ erro: "produto não encontrado" }, { status: 404 });

  const historico = await prisma.historicoCatalogo.findMany({
    where: { tenantId: t.id, produtoId: produto.id },
    orderBy: { versao: "desc" },
    take: 20,
    select: { versao: true, origem: true, campos: true, antes: true, depois: true, criadoEm: true },
  });

  return Response.json({ produto, historico });
}
