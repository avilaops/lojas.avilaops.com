import type { Prisma, Produto, Categoria } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { encaixe, lerCompatibilidade, type Moto } from "./motos";
import type { TemaLoja } from "./tema";

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
export const listarCategorias = cache(async (tenantId: string) => {
  // `cache()` do React: o layout (menu) e a página (blocos da home, filtros
  // do catálogo) pedem a mesma lista na mesma requisição, e cada pedido são
  // N subconsultas de contagem. Uma ida ao banco por requisição.
  const categorias = await prisma.categoria.findMany({
    where: { tenantId, produtos: { some: { ativo: true } } },
    include: { _count: { select: { produtos: { where: { ativo: true } } } } },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });

  // Quem tem mais produto aparece primeiro.
  //
  // O campo `ordem` guarda a sequência em que a categoria foi criada, não uma
  // escolha do lojista: na Vedashow a barra abria com "Vedações" (8 produtos)
  // enquanto "Retentores" (2.003) ficava em quarto. Numa distribuidora a
  // categoria que importa é a que tem estoque.
  //
  // O desempate segue `ordem`, então duas categorias do mesmo tamanho mantêm a
  // sequência que o lojista vê no painel.
  return categorias.sort((a, b) => b._count.produtos - a._count.produtos || a.ordem - b.ordem);
});

/**
 * Quais categorias entram nos blocos VISUAIS da home (atalhos redondos, grade
 * de departamentos), segundo a política da loja (`tema.categoriaSemImagem`).
 *
 * Só esses blocos: o menu de texto e o catálogo continuam mostrando todas,
 * porque ali a foto não é o que distingue. A regra mora aqui, e não em cada
 * layout, para os três layouts que têm bloco visual não divergirem.
 */
export function categoriasParaVitrine<C extends { imagemUrl: string | null }>(
  categorias: C[],
  politica: TemaLoja["categoriaSemImagem"],
): C[] {
  return politica === "ocultar" ? categorias.filter((c) => c.imagemUrl) : categorias;
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
   * Quantos pular antes de começar a devolver. Com `limite`, é a paginação
   * do catálogo público: a página 3 de 48 em 48 pede `pular: 96, limite: 48`.
   */
  pular?: number;
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

/**
 * Teto de sanidade para medida em milímetros.
 *
 * O filtro da Vedashow anunciava diâmetro interno "de 0 mm a 5.176.168 mm":
 * um código de peça lido como medida. Três metros cobre qualquer retentor,
 * rolamento ou anel que uma loja desta plataforma vai vender; acima disso não
 * é medida, é lixo de importação, e lixo não entra no filtro nem na faixa que
 * o formulário mostra. Zero também não: peça sem diâmetro não existe.
 */
export const MEDIDA_MAXIMA_MM = 3000;

export function medidaValida(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MEDIDA_MAXIMA_MM;
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
    ...(filtro?.limite && !filtro.moto && !filtro.medidas ? { take: filtro.limite, skip: filtro.pular ?? 0 } : {}),
  });
  const janela = <T>(lista: T[]) => (filtro?.limite ? lista.slice(filtro.pular ?? 0, (filtro.pular ?? 0) + filtro.limite) : lista);

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
        // quer o que cabe no eixo, e "não sei" não cabe. Medida absurda é
        // "não sei" com outro nome.
        if (!medidaValida(v)) return false;
        if (faixa.de != null && v < faixa.de) return false;
        if (faixa.ate != null && v > faixa.ate) return false;
        return true;
      });
    });
  }

  if (!filtro?.moto) return filtro?.medidas ? janela(lista) : lista;
  const moto = filtro.moto;
  const servem = lista.filter((p) => encaixe(p.compatibilidade, moto) === "serve");
  const universais = lista.filter((p) => encaixe(p.compatibilidade, moto) === "universal");
  return janela([...servem, ...universais]);
}

/**
 * Um produto tem o que mostrar para quem chega de fora?
 *
 * Sem foto e sem preço, a página é um nome e uma ficha: o Google não tem o
 * que exibir e o comprador não tem como decidir. É cadastro de referência, e
 * cadastro de referência fica fora do sitemap e da primeira vitrine. Continua
 * acessível pela busca da loja, que é onde quem sabe o código vai procurá-lo.
 *
 * Foto OU preço basta: "sob consulta" com foto é oferta; preço sem foto
 * também, desde que o card diga o que é.
 */
export function produtoPublicavel(p: Pick<Produto, "ativo" | "imagens" | "precoCentavos">): boolean {
  return p.ativo && (p.imagens.length > 0 || p.precoCentavos > 0);
}

/**
 * A prateleira da primeira tela, quando o lojista não marcou destaques.
 *
 * Duas coisas que a home fazia errado, e que só apareceram com catálogo
 * grande: carregava os 5.591 produtos da loja para mostrar dez (era isso o
 * TTFB de 3 s), e mostrava os dez primeiros por nome, que na Vedashow eram
 * abraçadeiras de R$ 1,80 sem foto. Quem tem foto e preço vem primeiro; os
 * outros só completam a fileira se faltar gente.
 *
 * Com moto escolhida o corte é por compatibilidade e continua em memória,
 * como em `listarProdutos`: aí a ordem por foto se aplica sobre o que serve.
 */
export async function vitrineDaLoja(tenantId: string, opcoes: { moto?: Moto | null; limite?: number } = {}) {
  const limite = opcoes.limite ?? 12;
  const completude = (p: Produto) => (p.imagens.length > 0 ? 1 : 0) + (p.precoCentavos > 0 ? 1 : 0);

  if (opcoes.moto) {
    const todos = await listarProdutos(tenantId, { moto: opcoes.moto });
    return todos.sort((a, b) => completude(b) - completude(a)).slice(0, limite);
  }

  const completos = await prisma.produto.findMany({
    where: { tenantId, ativo: true, imagens: { isEmpty: false }, precoCentavos: { gt: 0 } },
    include: { categoria: true },
    orderBy: ORDENS.relevancia,
    take: limite,
  });
  if (completos.length >= limite) return completos;

  const resto = await prisma.produto.findMany({
    where: { tenantId, ativo: true, id: { notIn: completos.map((p) => p.id) } },
    include: { categoria: true },
    orderBy: ORDENS.relevancia,
    take: limite * 4,
  });
  return [...completos, ...resto.sort((a, b) => completude(b) - completude(a))].slice(0, limite);
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
  // Cinco minutos em memória, por loja. Esta função lê o JSON de atributos de
  // TODOS os produtos ativos a cada visita ao catálogo, só para desenhar três
  // faixas de formulário que mudam quando o lojista importa planilha, não a
  // cada pedido de página. Na Vedashow são 5.591 linhas por visita.
  return unstable_cache(medidasDaLojaSemCache, ["medidas-da-loja"], { revalidate: 300 })(tenantId);
}

async function medidasDaLojaSemCache(tenantId: string) {
  const linhas = await prisma.produto.findMany({ where: { tenantId, ativo: true }, select: { atributos: true } });
  const valores = new Map<ChaveDeMedida, number[]>();
  for (const l of linhas) {
    const attr = (l.atributos ?? {}) as Record<string, unknown>;
    for (const campo of Object.keys(MEDIDAS_FILTRAVEIS) as ChaveDeMedida[]) {
      const v = Number(attr[campo]);
      if (!medidaValida(v)) continue;
      const lista = valores.get(campo) ?? [];
      lista.push(v);
      valores.set(campo, lista);
    }
  }
  // A faixa mostrada é onde o catálogo está, não onde o maior outlier está.
  //
  // Mesmo com o teto, um único rolamento de 2 m num catálogo de 20 a 120 mm
  // faria o campo anunciar "até 2000 mm", e o comprador digitaria 25 num
  // controle calibrado para dois metros. O 1º e o 99º percentil dão a faixa em
  // que 98% das peças cabem; quem digitar fora dela continua atendido, porque
  // o filtro usa o valor digitado, não a faixa.
  const percentil = (lista: number[], p: number) => lista[Math.min(lista.length - 1, Math.floor(lista.length * p))];
  // Menos de 20 produtos com a medida não é navegação, é campo vazio na tela.
  return (Object.keys(MEDIDAS_FILTRAVEIS) as ChaveDeMedida[])
    .map((campo) => {
      const lista = (valores.get(campo) ?? []).sort((a, b) => a - b);
      return {
        campo,
        rotulo: MEDIDAS_FILTRAVEIS[campo],
        min: lista.length ? Math.floor(percentil(lista, 0.01)) : 0,
        max: lista.length ? Math.ceil(percentil(lista, 0.99)) : 0,
        itens: lista.length,
      };
    })
    .filter((m) => m.itens >= 20);
}

/**
 * Marcas e modelos que a loja realmente atende (das compatibilidades dos
 * produtos ativos), com a contagem de peças por modelo. Alimenta o seletor
 * (junto com o catálogo-base) e o bloco "compre por moto" da home.
 */
export async function motosDaLoja(tenantId: string) {
  // Cinco minutos por loja, como `medidasDaLoja`: lê o JSON de compatibilidade
  // de todos os produtos ativos para montar um seletor que muda quando o
  // lojista cadastra peça, não a cada visita.
  return unstable_cache(motosDaLojaSemCache, ["motos-da-loja"], { revalidate: 300 })(tenantId);
}

async function motosDaLojaSemCache(tenantId: string) {
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
