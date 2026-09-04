import { prisma } from "@/lib/db";
import { termosDeBusca } from "@/lib/catalogo";
import { exigir } from "@/lib/operadores";
import type { Prisma } from "@prisma/client";

/**
 * A listagem do catálogo no painel: busca, filtro e página.
 *
 * A tela carregava os 500 primeiros produtos de uma vez, ordenados por nome.
 * Numa distribuidora com 5.591 itens isso quer dizer que **o lojista não
 * enxergava 91% do que vende**, e não havia como procurar: quem precisava
 * mexer no preço de um rolamento que começa com "R" simplesmente não achava.
 *
 * A busca usa o mesmo `termosDeBusca` da vitrine, então "ROL6205" e "25x52x15"
 * funcionam aqui também. É o mesmo gesto que o lojista já usa na loja dele.
 */
export const dynamic = "force-dynamic";

/** Mesma medida do inventário: 25 cabe em poucas rolagens no celular e ainda
 *  dá visão de conjunto no computador. Com 50 a tela ia a 9.201px. */
const POR_PAGINA = 25;

export async function GET(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;

  const url = new URL(request.url);
  const busca = (url.searchParams.get("q") ?? "").trim();
  const categoria = (url.searchParams.get("categoria") ?? "").trim();
  const situacao = (url.searchParams.get("situacao") ?? "").trim();
  const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? 1) || 1);

  const where: Prisma.ProdutoWhereInput = { tenantId: s.tenant.id };

  if (busca) {
    // Todos os termos precisam casar, como na vitrine: "retentor 30x47" tem
    // que trazer o retentor daquela medida, não todo retentor da loja.
    where.AND = termosDeBusca(busca).map((termo) => ({ busca: { contains: termo } }));
  }
  if (categoria) where.categoria = { slug: categoria };

  // Situação é a pergunta que o lojista faz de verdade: "o que está esgotado?",
  // "o que está sem foto?". Não é filtro de banco de dados, é trabalho do dia.
  if (situacao === "ativo") where.ativo = true;
  else if (situacao === "inativo") where.ativo = false;
  else if (situacao === "esgotado") where.OR = [{ disponibilidade: "out_of_stock" }, { estoque: 0 }];
  else if (situacao === "sem-foto") where.imagens = { isEmpty: true };
  else if (situacao === "sem-preco") where.precoCentavos = 0;

  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      include: { categoria: { select: { nome: true } }, _count: { select: { variantes: { where: { ativo: true } } } } },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return Response.json({
    total,
    pagina,
    porPagina: POR_PAGINA,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria?.nome ?? null,
      sku: p.sku,
      precoCentavos: p.precoCentavos,
      estoque: p.estoque,
      ativo: p.ativo,
      destaque: p.destaque,
      opcoes: p.opcoes,
      variantes: p._count.variantes,
      temFoto: p.imagens.length > 0,
    })),
  });
}
