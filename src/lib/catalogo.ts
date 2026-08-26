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

export interface ProblemaDeFeed {
  nome: string;
  /** O que impede o produto de entrar no catálogo de anúncios. */
  bloqueios: string[];
  /** O que não impede, mas faz o anúncio render menos. */
  avisos: string[];
}

export interface DiagnosticoFeed {
  total: number;
  prontos: number;
  problemas: ProblemaDeFeed[];
}

/**
 * O mesmo feed serve Google Merchant, Meta Commerce Manager e TikTok — os três
 * leem RSS 2.0 com namespace `g:`. O que costuma dar errado não é o formato, é
 * produto sem foto ou sem descrição, que a plataforma reprova em silêncio.
 * Aqui o lojista vê a lista antes de subir o catálogo.
 */
export async function diagnosticoDoFeed(tenantId: string): Promise<DiagnosticoFeed> {
  const produtos = await prisma.produto.findMany({
    where: { tenantId, ativo: true },
    select: { nome: true, imagens: true, descricao: true, descricaoCurta: true, precoCentavos: true, marca: true, gtin: true, categoriaId: true },
    orderBy: { nome: "asc" },
    take: 1000,
  });

  const problemas: ProblemaDeFeed[] = [];
  let prontos = 0;
  for (const p of produtos) {
    const bloqueios: string[] = [];
    const avisos: string[] = [];
    if (!p.imagens.length) bloqueios.push("foto");
    if (!(p.descricaoCurta ?? p.descricao)) bloqueios.push("descrição");
    if (p.precoCentavos <= 0) bloqueios.push("preço");
    if (!p.marca) avisos.push("marca");
    if (!p.categoriaId) avisos.push("categoria");
    if (!p.gtin) avisos.push("código de barras");
    if (!bloqueios.length) prontos++;
    if (bloqueios.length || avisos.length) problemas.push({ nome: p.nome, bloqueios, avisos });
  }

  // Quem trava o catálogo aparece primeiro; a lista é para agir, não para ler inteira.
  problemas.sort((a, b) => b.bloqueios.length - a.bloqueios.length);
  return { total: produtos.length, prontos, problemas: problemas.slice(0, 12) };
}
