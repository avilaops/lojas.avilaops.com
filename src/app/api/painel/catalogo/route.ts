import { prisma } from "@/lib/db";
import { condicaoDoCatalogo, filtroDaUrl, varianteSemIdentificadores } from "@/lib/catalogo-filtros";
import { exigir } from "@/lib/operadores";

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
  const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? 1) || 1);
  // Busca, categoria e situação saem daqui já do jeito que a exportação
  // também lê (src/lib/catalogo-filtros.ts): lista e planilha não podem
  // discordar sobre o que é "sem foto".
  const where = condicaoDoCatalogo(s.tenant.id, filtroDaUrl(url));

  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      include: {
        categoria: { select: { nome: true } },
        variantes: { where: varianteSemIdentificadores, select: { id: true }, take: 1 },
        _count: { select: { variantes: { where: { ativo: true, padrao: false } } } },
      },
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
      marca: p.marca,
      sku: p.sku,
      precoCentavos: p.precoCentavos,
      estoque: p.estoque,
      ativo: p.ativo,
      destaque: p.destaque,
      opcoes: p.opcoes,
      variantes: p._count.variantes,
      identificadoresPendentes: p.variantes.length > 0,
      fotoMerchantRevisar: p.imagens.length === 0 || p.imagemOrigem !== "propria",
      temFoto: p.imagens.length > 0,
    })),
  });
}
