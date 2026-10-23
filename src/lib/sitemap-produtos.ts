import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CONDICAO_PUBLICAVEL } from "./produto-regras";

const PRODUTOS_POR_PAGINA = 1_000;

export type PaginaDoSitemap = {
  cursor?: string;
  limite: number;
};

/**
 * Percorre um catálogo por cursor, sem montar uma consulta única proporcional
 * ao tamanho da loja. O cursor é o último id já recebido, portanto cada item
 * entra exatamente uma vez mesmo em catálogos com milhares de produtos.
 */
export async function paginarProdutosDoSitemap<T extends { id: string }>(
  buscar: (pagina: PaginaDoSitemap) => Promise<T[]>,
): Promise<T[]> {
  const produtos: T[] = [];
  let cursor: string | undefined;

  while (true) {
    const pagina = await buscar({ cursor, limite: PRODUTOS_POR_PAGINA });
    produtos.push(...pagina);
    if (pagina.length < PRODUTOS_POR_PAGINA) return produtos;
    cursor = pagina[pagina.length - 1]!.id;
  }
}

const CAMPOS_DO_SITEMAP = {
  id: true,
  slug: true,
  ativo: true,
  precoCentavos: true,
  precoDeCentavos: true,
  imagens: true,
  imagemOrigem: true,
  disponibilidade: true,
  estoque: true,
  atualizadoEm: true,
} satisfies Prisma.ProdutoSelect;

/** Consulta mínima do sitemap: sem categoria, variantes, ficha ou descrições. */
export function listarProdutosDoSitemap(tenantId: string) {
  return paginarProdutosDoSitemap(({ cursor, limite }) =>
    prisma.produto.findMany({
      where: { tenantId, ...CONDICAO_PUBLICAVEL },
      select: CAMPOS_DO_SITEMAP,
      orderBy: { id: "asc" },
      take: limite,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  );
}
