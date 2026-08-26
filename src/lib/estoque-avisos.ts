import { prisma } from "./db";
import { emitir } from "./eventos";
import { urlDaLoja } from "./tenant";

/**
 * Fila de espera por produto: quem pediu "avise-me" recebe um e-mail quando o
 * produto volta. Roda de hora em hora pelo n8n.
 *
 * O aviso sai uma vez por pessoa por produto (`avisadoEm`); se o produto acabar
 * de novo e a pessoa pedir outra vez, o upsert da API reabre o pedido dela.
 */
export async function avisarQuemEsperava(): Promise<{ avisos: number }> {
  const pendentes = await prisma.avisoEstoque.findMany({
    where: {
      avisadoEm: null,
      produto: { ativo: true, disponibilidade: { not: "out_of_stock" }, OR: [{ estoque: null }, { estoque: { gt: 0 } }] },
    },
    include: { produto: { select: { nome: true, slug: true, precoCentavos: true } }, tenant: true },
    take: 500,
  });

  for (const a of pendentes) {
    await emitir({
      tipo: "loja.voltou-ao-estoque",
      slug: a.tenant.slug,
      nome: a.tenant.nome,
      url: `${urlDaLoja(a.tenant)}/produtos/${a.produto.slug}`,
      emailRemetente: a.tenant.emailRemetente,
      destinatario: a.email,
      telefone: a.telefone,
      produtoNome: a.produto.nome,
      precoCentavos: a.produto.precoCentavos,
    });
    await prisma.avisoEstoque.update({ where: { id: a.id }, data: { avisadoEm: new Date() } });
  }

  return { avisos: pendentes.length };
}

/** Quem a loja tem esperando, por produto — vira lista de reposição no painel. */
export async function filaDeEspera(tenantId: string) {
  const agrupado = await prisma.avisoEstoque.groupBy({
    by: ["produtoId"],
    where: { tenantId, avisadoEm: null },
    _count: { _all: true },
    orderBy: { _count: { produtoId: "desc" } },
    take: 5,
  });
  if (!agrupado.length) return [];
  const produtos = await prisma.produto.findMany({ where: { id: { in: agrupado.map((g) => g.produtoId) } }, select: { id: true, nome: true } });
  const nomes = new Map(produtos.map((p) => [p.id, p.nome]));
  return agrupado.map((g) => ({ produto: nomes.get(g.produtoId) ?? "—", pessoas: g._count._all }));
}
