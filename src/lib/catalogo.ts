import type { Prisma, Produto, Categoria } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { prisma } from "./db";
import { encaixe, lerCompatibilidade, type Moto } from "./motos";

export type ProdutoComCategoria = Produto & { categoria: Categoria | null };

/**
 * Categorias que a vitrine anuncia.
 *
 * Só entram as que têm produto ativo. Categoria vazia no menu é beco sem saída:
 * o comprador clica em "Pneus", cai num "nenhum produto encontrado" e conclui
 * que a loja não trabalha com pneu, quando o lojista apenas criou a gaveta
 * antes de guardar alguma coisa dentro. No sitemap é pior, porque aí quem
 * recebe a página vazia é o Google.
 *
 * A categoria continua existindo: o painel lê o banco direto e mostra todas,
 * inclusive as vazias, que é justamente onde o lojista precisa vê-las.
 */
export async function listarCategorias(tenantId: string) {
  return prisma.categoria.findMany({
    where: { tenantId, produtos: { some: { ativo: true } } },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
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
  /**
   * Moto do comprador (segmento motopecas): o que serve vem primeiro, o
   * universal (sem compatibilidade) vem depois, o que não serve some.
   */
  moto?: Moto | null;
}

const ORDENS: Record<OrdemCatalogo, Prisma.ProdutoOrderByWithRelationInput[]> = {
  relevancia: [{ destaque: "desc" }, { nome: "asc" }],
  "menor-preco": [{ precoCentavos: "asc" }],
  "maior-preco": [{ precoCentavos: "desc" }],
  recentes: [{ criadoEm: "desc" }],
  nome: [{ nome: "asc" }],
};

/**
 * Normaliza o que a pessoa digitou do mesmo jeito que o gatilho normaliza o
 * produto: minúsculas, sem acento. Cada palavra vira uma condição — "valvula
 * pressao" só traz quem tem as duas, em qualquer ordem.
 */
export function termosDeBusca(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 6);
}

export async function listarProdutos(tenantId: string, filtro?: FiltroCatalogo) {
  const produtos = await prisma.produto.findMany({
    where: {
      tenantId,
      ativo: true,
      ...(filtro?.destaque ? { destaque: true } : {}),
      ...(filtro?.categoriaSlug ? { categoria: { slug: filtro.categoriaSlug } } : {}),
      ...(filtro?.excetoId ? { id: { not: filtro.excetoId } } : {}),
      ...(filtro?.minCentavos != null || filtro?.maxCentavos != null
        ? { precoCentavos: { ...(filtro.minCentavos != null ? { gte: filtro.minCentavos } : {}), ...(filtro.maxCentavos != null ? { lte: filtro.maxCentavos } : {}) } }
        : {}),
      ...(filtro?.busca ? { AND: termosDeBusca(filtro.busca).map((t) => ({ busca: { contains: t } })) } : {}),
    },
    include: { categoria: true },
    orderBy: ORDENS[filtro?.ordem ?? "relevancia"],
    // Com moto escolhida o corte é feito depois, então o limite também.
    ...(filtro?.limite && !filtro.moto ? { take: filtro.limite } : {}),
  });
  if (!filtro?.moto) return produtos;
  // Catálogo de loja pequena cabe na memória; filtrar aqui evita consulta em
  // JSON com faixa de anos, que o Prisma não expressa e o Postgres não indexa bem.
  const moto = filtro.moto;
  const servem = produtos.filter((p) => encaixe(p.compatibilidade, moto) === "serve");
  const universais = produtos.filter((p) => encaixe(p.compatibilidade, moto) === "universal");
  const lista = [...servem, ...universais];
  return filtro.limite ? lista.slice(0, filtro.limite) : lista;
}

/**
 * Marcas e modelos que a loja realmente atende (das compatibilidades dos
 * produtos ativos), com a contagem de peças por modelo. Alimenta o seletor
 * (junto com o catálogo-base) e o bloco "compre por moto" da home.
 */
export async function motosDaLoja(tenantId: string) {
  const linhas = await prisma.produto.findMany({ where: { tenantId, ativo: true }, select: { compatibilidade: true } });
  const porMarca: Record<string, string[]> = {};
  const contagem = new Map<string, { marca: string; modelo: string; pecas: number }>();
  for (const l of linhas) {
    const vistas = new Set<string>();
    for (const c of lerCompatibilidade(l.compatibilidade)) {
      const chave = `${c.marca}|${c.modelo}`;
      if (!(porMarca[c.marca] ??= []).includes(c.modelo)) porMarca[c.marca].push(c.modelo);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      const atual = contagem.get(chave) ?? { marca: c.marca, modelo: c.modelo, pecas: 0 };
      atual.pecas++;
      contagem.set(chave, atual);
    }
  }
  const populares = [...contagem.values()].sort((a, b) => b.pecas - a.pecas || a.modelo.localeCompare(b.modelo, "pt-BR", { numeric: true }));
  return { porMarca, populares };
}

/** Marcas de produto (fabricantes de peças) da loja, mais frequentes primeiro. */
export async function marcasDaLoja(tenantId: string): Promise<string[]> {
  const grupos = await prisma.produto.groupBy({ by: ["marca"], where: { tenantId, ativo: true, marca: { not: null } }, _count: { _all: true }, orderBy: [{ _count: { marca: "desc" } }, { marca: "asc" }], take: 24 });
  return grupos.map((g) => g.marca).filter((m): m is string => !!m);
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
        nome: `${prod.nome} · ${v.nome}`,
        quantidade: p.quantidade,
        precoUnitario: v.precoCentavos ?? prod.precoCentavos,
        imagem: v.imagem ?? prod.imagens[0],
        sku: v.sku ?? prod.sku ?? undefined,
        pesoGramas: (v.pesoKg ?? prod.pesoKg) != null ? Math.round((v.pesoKg ?? prod.pesoKg)! * 1000) : undefined,
        // Variação não tem medida própria: a embalagem é a do produto.
        alturaCm: prod.alturaCm ?? undefined,
        larguraCm: prod.larguraCm ?? undefined,
        comprimentoCm: prod.comprimentoCm ?? undefined,
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
      alturaCm: prod.alturaCm ?? undefined,
      larguraCm: prod.larguraCm ?? undefined,
      comprimentoCm: prod.comprimentoCm ?? undefined,
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

export interface ProvaSocial {
  media: number | null;
  total: number;
  avaliacoes: Array<{ id: string; nome: string; nota: number; texto: string; produtoNome: string; produtoSlug: string; criadoEm: Date }>;
}

/**
 * O que os clientes dizem, para a home. Só entra avaliação aprovada e com
 * texto — nota solta sem comentário não convence ninguém, e loja nova com duas
 * avaliações parece mais vazia do que se não mostrasse nada (por isso o
 * componente só desenha a partir de três).
 */
export async function provaSocialDa(tenantId: string): Promise<ProvaSocial> {
  const [avaliacoes, resumo] = await Promise.all([
    prisma.avaliacao.findMany({
      where: { tenantId, aprovada: true, NOT: { texto: null } },
      orderBy: { criadoEm: "desc" },
      take: 6,
      include: { produto: { select: { nome: true, slug: true } } },
    }),
    prisma.avaliacao.aggregate({ where: { tenantId, aprovada: true }, _avg: { nota: true }, _count: { _all: true } }),
  ]);

  return {
    media: resumo._avg.nota ? Math.round(resumo._avg.nota * 10) / 10 : null,
    total: resumo._count._all,
    avaliacoes: avaliacoes.map((a) => ({ id: a.id, nome: a.nome, nota: a.nota, texto: a.texto ?? "", produtoNome: a.produto.nome, produtoSlug: a.produto.slug, criadoEm: a.criadoEm })),
  };
}
