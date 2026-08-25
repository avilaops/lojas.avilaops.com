import type { Prisma, Produto, Categoria } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { prisma } from "./db";

export type ProdutoComCategoria = Produto & { categoria: Categoria | null };

export async function listarCategorias(tenantId: string) {
  return prisma.categoria.findMany({ where: { tenantId }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
}

export type OrdemCatalogo = "relevancia" | "menor-preco" | "maior-preco" | "recentes" | "nome";

export interface FiltroCatalogo {
  categoriaSlug?: string;
  busca?: string;
  destaque?: boolean;
  minCentavos?: number;
  maxCentavos?: number;
  ordem?: OrdemCatalogo;
  /** Deixa de fora este id (ex.: "relacionados" na página do produto). */
  excetoId?: string;
  limite?: number;
}

const ORDENS: Record<OrdemCatalogo, Prisma.ProdutoOrderByWithRelationInput[]> = {
  relevancia: [{ destaque: "desc" }, { nome: "asc" }],
  "menor-preco": [{ precoCentavos: "asc" }],
  "maior-preco": [{ precoCentavos: "desc" }],
  recentes: [{ criadoEm: "desc" }],
  nome: [{ nome: "asc" }],
};

export async function listarProdutos(tenantId: string, filtro?: FiltroCatalogo) {
  return prisma.produto.findMany({
    where: {
      tenantId,
      ativo: true,
      ...(filtro?.destaque ? { destaque: true } : {}),
      ...(filtro?.categoriaSlug ? { categoria: { slug: filtro.categoriaSlug } } : {}),
      ...(filtro?.excetoId ? { id: { not: filtro.excetoId } } : {}),
      ...(filtro?.minCentavos != null || filtro?.maxCentavos != null
        ? { precoCentavos: { ...(filtro.minCentavos != null ? { gte: filtro.minCentavos } : {}), ...(filtro.maxCentavos != null ? { lte: filtro.maxCentavos } : {}) } }
        : {}),
      ...(filtro?.busca
        ? { OR: [{ nome: { contains: filtro.busca, mode: "insensitive" } }, { marca: { contains: filtro.busca, mode: "insensitive" } }, { sku: { contains: filtro.busca, mode: "insensitive" } }, { descricaoCurta: { contains: filtro.busca, mode: "insensitive" } }] }
        : {}),
    },
    include: { categoria: true },
    orderBy: ORDENS[filtro?.ordem ?? "relevancia"],
    ...(filtro?.limite ? { take: filtro.limite } : {}),
  });
}

/** Média e contagem das avaliações aprovadas de um produto. */
export async function resumoAvaliacoes(produtoId: string) {
  const r = await prisma.avaliacao.aggregate({ where: { produtoId, aprovada: true }, _avg: { nota: true }, _count: { _all: true } });
  return { media: r._avg.nota ? Math.round(r._avg.nota * 10) / 10 : null, total: r._count._all };
}

export async function buscarProduto(tenantId: string, slug: string) {
  return prisma.produto.findFirst({ where: { tenantId, slug, ativo: true }, include: { categoria: true, variantes: { where: { ativo: true }, orderBy: { ordem: "asc" } } } });
}

/**
 * Resolve os itens do pedido pelo catálogo, no servidor.
 *
 * É a peça que o @avilaops/checkout exige: o preço nunca vem do navegador.
 * Produto inativo ou de outra loja simplesmente não é devolvido, e o pacote
 * recusa o pedido com "item_indisponivel".
 */
export async function resolverItensDoCatalogo(
  tenantId: string,
  pedidos: Array<{ id: string; quantidade: number }>,
): Promise<ItemCarrinho[]> {
  // O id do carrinho é `<produtoId>` ou `<produtoId>:<varianteId>`.
  const pares = pedidos.map((p) => ({ ...p, produtoId: p.id.split(":")[0], varianteId: p.id.split(":")[1] ?? null }));
  const produtos = await prisma.produto.findMany({
    where: { tenantId, id: { in: pares.map((p) => p.produtoId) }, ativo: true, disponibilidade: { not: "out_of_stock" } },
    include: { variantes: { where: { ativo: true } } },
  });
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const itens: ItemCarrinho[] = [];
  for (const p of pares) {
    const prod = porId.get(p.produtoId);
    if (!prod) continue;
    if (prod.opcoes.length > 0) {
      // Produto com variações só entra com uma variação válida e com estoque.
      const v = prod.variantes.find((x) => x.id === p.varianteId);
      if (!v) continue;
      if (v.estoque != null && v.estoque < p.quantidade) continue;
      itens.push({
        id: `${prod.id}:${v.id}`,
        nome: `${prod.nome} — ${v.nome}`,
        quantidade: p.quantidade,
        precoUnitario: v.precoCentavos ?? prod.precoCentavos,
        imagem: v.imagem ?? prod.imagens[0],
        sku: v.sku ?? prod.sku ?? undefined,
        pesoGramas: (v.pesoKg ?? prod.pesoKg) != null ? Math.round((v.pesoKg ?? prod.pesoKg)! * 1000) : undefined,
      });
      continue;
    }
    if (prod.estoque != null && prod.estoque < p.quantidade) continue;
    itens.push({
      id: prod.id,
      nome: prod.nome,
      quantidade: p.quantidade,
      precoUnitario: prod.precoCentavos,
      imagem: prod.imagens[0],
      sku: prod.sku ?? undefined,
      pesoGramas: prod.pesoKg != null ? Math.round(prod.pesoKg * 1000) : undefined,
    });
  }
  return itens;
}

export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
