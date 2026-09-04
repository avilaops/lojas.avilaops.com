import { prisma } from "@/lib/db";
import { termosDeBusca } from "@/lib/catalogo";
import { exigir } from "@/lib/operadores";
import type { Prisma } from "@prisma/client";

/**
 * O inventário, com busca, filtro e página.
 *
 * A tela mandava as 500 primeiras linhas de uma vez e ficava com 19.672px de
 * altura no celular — cinquenta telas de rolagem para achar um item. Medido em
 * 04/09/2026 no catálogo da Vedashow.
 *
 * O resumo vem junto porque é a pergunta que o lojista faz antes de olhar a
 * lista: "quantos estão esgotados?". Ele conta o catálogo inteiro, não a
 * página, senão diz um número que não é o dele.
 */
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

export async function GET(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;

  const url = new URL(request.url);
  const busca = (url.searchParams.get("q") ?? "").trim();
  const situacao = (url.searchParams.get("situacao") ?? "").trim();
  const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? 1) || 1);

  const baixo = s.tenant.estoqueBaixoEm;

  // Só produto com contagem entra: "∞" numa tela de estoque é ruído, e produto
  // com variação tem o estoque na variante, não nele.
  const base: Prisma.ProdutoWhereInput = {
    tenantId: s.tenant.id,
    ativo: true,
    estoque: { not: null },
    opcoes: { isEmpty: true },
  };

  const where: Prisma.ProdutoWhereInput = { ...base };
  if (busca) where.AND = termosDeBusca(busca).map((t) => ({ busca: { contains: t } }));
  if (situacao === "esgotado") where.estoque = 0;
  else if (situacao === "baixo") where.estoque = { gt: 0, lte: baixo };

  const [total, itens, esgotados, comBaixo, todos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      select: { id: true, nome: true, sku: true, estoque: true, precoCentavos: true },
      // Quem está acabando primeiro: é a ordem do trabalho, não do alfabeto.
      orderBy: [{ estoque: "asc" }, { nome: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.produto.count({ where: { ...base, estoque: 0 } }),
    prisma.produto.count({ where: { ...base, estoque: { gt: 0, lte: baixo } } }),
    prisma.produto.count({ where: base }),
  ]);

  return Response.json({
    total,
    pagina,
    porPagina: POR_PAGINA,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    resumo: { todos, esgotados, baixo: comBaixo, limiteBaixo: baixo },
    itens,
  });
}
