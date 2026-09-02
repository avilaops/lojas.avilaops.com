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
  /**
   * Faixa de medida, em milímetros, sobre `Produto.atributos`.
   *
   * É a navegação que catálogo técnico exige e que marketplace generalista não
   * tem: quem procura peça sabe a medida do eixo, não o código do fabricante.
   * Cada faixa é opcional e independente — dá para pedir só o diâmetro interno.
   */
  medidas?: Partial<Record<ChaveDeMedida, { de?: number; ate?: number }>>;
}

/** As três medidas que o catálogo indexa. O nome é o do campo em `atributos`. */
export const MEDIDAS_FILTRAVEIS = {
  diametroInternoMm: "Diâmetro interno",
  diametroExternoMm: "Diâmetro externo",
  alturaMm: "Altura",
} as const;

export type ChaveDeMedida = keyof typeof MEDIDAS_FILTRAVEIS;

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
 *
 * **A medida quebra junto.** Em catálogo técnico a pessoa digita a peça do
 * jeito que ela é falada na oficina: `20x47x14`, `20 × 47 × 14`, `6204-2RS`.
 * Separando só por espaço, `20x47x14` virava um token único que não casa com
 * nada, e a loja respondia "nenhum produto" tendo o item em estoque. Agora o
 * `x`, o `×` e o `-` entre números também separam.
 *
 * O hífen **não** separa quando gruda letra e número (`6204-2rs`, `uc209`):
 * ali ele faz parte do código da peça, e quebrar destruiria a busca por código.
 */
export function termosDeBusca(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    // 20x47x14 / 20×47×14 → 20 47 14. Só entre dígitos.
    .replace(/(?<=\d)\s*[x×]\s*(?=\d)/g, " ")
    // 20-47-14 → 20 47 14, e também 6204-2rs → 6204 2rs.
    //
    // Medido contra o catálogo da Vedashow em 02/09/2026: "6205 2RS" achava 6
    // produtos e "6205-2rs" achava 2, porque o termo com hífen só casava com
    // quem tinha o hífen escrito igual no cadastro. Quem digita o código com
    // hífen procura a mesma peça de quem digita com espaço.
    .replace(/(?<=\d)-(?=[\da-z])/g, " ")
    // ROL6205 → rol 6205, RET30X47X7 → ret 30 47 7.
    //
    // O prefixo de balcão ("ROL", "RET", "COR") vem colado no código no sistema
    // do lojista, e o comprador digita do mesmo jeito. Separar faz o termo do
    // código casar sozinho; o prefixo vira mais um termo, que só ajuda.
    .replace(/([a-z]{2,4})\.?(?=\d)/g, "$1 ")
    .split(/[\s.]+/)
    // Letra solta casa com quase tudo e só suja o resultado. Dígito solto não:
    // "35x52x8" tem uma medida de um dígito, e descartá-la traria todo
    // retentor 35x52 em vez do que a pessoa pediu.
    .filter((t) => t.length > 1 || /\d/.test(t))
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
    // Com moto ou medida escolhida o corte é feito depois, então o limite também.
    ...(filtro?.limite && !filtro.moto && !filtro.medidas ? { take: filtro.limite } : {}),
  });

  // Medida vive em `atributos` (JSON), que o Prisma não sabe comparar por
  // faixa. Filtrar aqui segue o mesmo caminho já usado pela compatibilidade de
  // moto: o catálogo de uma loja cabe na memória, e a alternativa seria SQL
  // cru, perdendo a tipagem em troca de milissegundos que ninguém percebe.
  let lista = produtos;
  if (filtro?.medidas) {
    const faixas = Object.entries(filtro.medidas) as Array<[ChaveDeMedida, { de?: number; ate?: number }]>;
    lista = lista.filter((p) => {
      const attr = (p.atributos ?? {}) as Record<string, unknown>;
      return faixas.every(([campo, faixa]) => {
        const v = Number(attr[campo]);
        // Produto sem a medida cadastrada não entra: quem filtra por 20-25 mm
        // quer o que cabe no eixo, e "não sei" não cabe.
        if (!Number.isFinite(v)) return false;
        if (faixa.de != null && v < faixa.de) return false;
        if (faixa.ate != null && v > faixa.ate) return false;
        return true;
      });
    });
  }

  if (!filtro?.moto) return filtro?.limite && filtro.medidas ? lista.slice(0, filtro.limite) : lista;
  const moto = filtro.moto;
  const servem = lista.filter((p) => encaixe(p.compatibilidade, moto) === "serve");
  const universais = lista.filter((p) => encaixe(p.compatibilidade, moto) === "universal");
  const ordenada = [...servem, ...universais];
  return filtro.limite ? ordenada.slice(0, filtro.limite) : ordenada;
}

/**
 * Quais medidas esta loja realmente usa, e a faixa de cada uma.
 *
 * O filtro de medida só faz sentido em catálogo técnico: loja de roupa não tem
 * diâmetro interno, e campo que nunca filtra nada é ruído no formulário. Como
 * a decisão sai do dado, nenhuma loja precisa de configuração — e a de peças
 * ganha a navegação sozinha.
 */
export async function medidasDaLoja(tenantId: string) {
  const linhas = await prisma.produto.findMany({ where: { tenantId, ativo: true }, select: { atributos: true } });
  const faixas = new Map<ChaveDeMedida, { min: number; max: number; itens: number }>();
  for (const l of linhas) {
    const attr = (l.atributos ?? {}) as Record<string, unknown>;
    for (const campo of Object.keys(MEDIDAS_FILTRAVEIS) as ChaveDeMedida[]) {
      const v = Number(attr[campo]);
      if (!Number.isFinite(v)) continue;
      const f = faixas.get(campo) ?? { min: v, max: v, itens: 0 };
      f.min = Math.min(f.min, v);
      f.max = Math.max(f.max, v);
      f.itens++;
      faixas.set(campo, f);
    }
  }
  // Menos de 20 produtos com a medida não é navegação, é campo vazio na tela.
  return (Object.keys(MEDIDAS_FILTRAVEIS) as ChaveDeMedida[])
    .map((campo) => ({ campo, rotulo: MEDIDAS_FILTRAVEIS[campo], ...(faixas.get(campo) ?? { min: 0, max: 0, itens: 0 }) }))
    .filter((m) => m.itens >= 20);
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
    // `precoCentavos > 0` fecha a porta do item sob consulta: ele existe no
    // catálogo para ser encontrado, não para ser comprado. A vitrine já não
    // oferece carrinho para ele, mas a trava tem que estar aqui — é esta
    // função que decide o preço que o cliente paga, e o carrinho vem do
    // navegador. Sem isso, um id forjado compraria a peça por R$ 0,00.
    where: { tenantId, id: { in: pares.map((p) => p.produtoId) }, ativo: true, disponibilidade: { not: "out_of_stock" }, precoCentavos: { gt: 0 } },
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
