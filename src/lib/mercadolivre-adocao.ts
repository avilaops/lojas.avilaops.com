import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl } from "./mercadolivre";

/**
 * Adotar anúncios que já existem no Mercado Livre do lojista.
 *
 * Existe porque quase todo lojista que conecta o Mercado Livre **já vende
 * lá**. Até aqui, conectar não ligava nada: `AnuncioMercadoLivre` só ganhava
 * `mlbId` quando éramos nós a publicar, então os anúncios dele ficavam de
 * fora de tudo. O preço e o estoque não sincronizavam, o aviso de mudança de
 * item era descartado com "o anúncio não é desta loja", e a venda chegava sem
 * produto casado — logo, sem baixar estoque nenhum.
 *
 * **Adotar não publica nada, e aqui nada é automático.** Vincular um anúncio
 * é entregar a ele o preço e o estoque da loja: o ciclo seguinte passa a
 * mandar os nossos por cima dos dele. Fazer isso por conta própria, a partir
 * de um palpite de nome, mudaria preço de venda sem ninguém pedir. Por isso
 * esta camada **propõe** — com o que casou, por quê, e o que mudaria — e quem
 * decide é o lojista, como já acontece em "prontos para anunciar".
 */

/** O recorte de `GET /items?ids=…` que a adoção lê. */
export interface ItemDoVendedor {
  id: string;
  title?: string;
  permalink?: string;
  status?: string;
  price?: number;
  available_quantity?: number;
  category_id?: string;
  seller_custom_field?: string | null;
  attributes?: Array<{ id?: string; value_name?: string | null }> | null;
  variations?: Array<{ id?: number | string; seller_custom_field?: string | null }> | null;
}

/** O que a loja tem, no mínimo necessário para reconhecer o anúncio. */
export interface ProdutoDoCatalogo {
  produtoId: string;
  nome: string;
  sku: string | null;
  gtin: string | null;
  precoCentavos: number;
  estoque: number | null;
  variantes: Array<{ sku: string | null; gtin: string | null }>;
}

/** SKU não é sensível a caixa nem a espaço nas bordas. */
const chaveSku = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim().toUpperCase();
  return t || null;
};

/**
 * GTIN só como dígito: o lojista digita com hífen, o ML devolve sem, e os dois
 * são o mesmo código de barras.
 */
const chaveGtin = (v: string | null | undefined): string | null => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d : null;
};

const atributo = (item: ItemDoVendedor, id: string): string | null =>
  item.attributes?.find((a) => a.id === id)?.value_name ?? null;

/** Todo SKU que o anúncio carrega — o do item e o de cada variação. */
export function skusDoAnuncio(item: ItemDoVendedor): string[] {
  const brutos = [
    item.seller_custom_field,
    atributo(item, "SELLER_SKU"),
    ...(item.variations ?? []).map((v) => v.seller_custom_field),
  ];
  return [...new Set(brutos.map(chaveSku).filter((s): s is string => Boolean(s)))];
}

export type ForcaDoCasamento = "sku" | "gtin";

export interface Casamento {
  produtoId: string;
  por: ForcaDoCasamento;
  /** O valor que casou, para o lojista conferir em vez de confiar. */
  valor: string;
}

/**
 * Qual produto da loja é este anúncio.
 *
 * Só identificador: SKU e GTIN. **Título não entra**, por mais tentador que
 * seja — "Correia 5PK 1230" casa com meia dúzia de correias parecidas, e um
 * casamento errado aqui não erra uma tela: manda o preço de um produto para o
 * anúncio de outro no ciclo seguinte.
 *
 * E casa só quando é **único** dos dois lados. Dois produtos com o mesmo SKU
 * é problema de catálogo, não uma escolha a ser feita por sorteio.
 */
export function casarAnuncioComCatalogo(item: ItemDoVendedor, catalogo: ProdutoDoCatalogo[]): Casamento | null {
  const porSku = new Map<string, Set<string>>();
  const porGtin = new Map<string, Set<string>>();
  const juntar = (mapa: Map<string, Set<string>>, chave: string | null, produtoId: string) => {
    if (!chave) return;
    const atual = mapa.get(chave) ?? new Set<string>();
    atual.add(produtoId);
    mapa.set(chave, atual);
  };

  for (const p of catalogo) {
    juntar(porSku, chaveSku(p.sku), p.produtoId);
    juntar(porGtin, chaveGtin(p.gtin), p.produtoId);
    for (const v of p.variantes) {
      juntar(porSku, chaveSku(v.sku), p.produtoId);
      juntar(porGtin, chaveGtin(v.gtin), p.produtoId);
    }
  }

  for (const sku of skusDoAnuncio(item)) {
    const donos = porSku.get(sku);
    if (donos?.size === 1) return { produtoId: [...donos][0], por: "sku", valor: sku };
  }

  const gtin = chaveGtin(atributo(item, "GTIN"));
  if (gtin) {
    const donos = porGtin.get(gtin);
    if (donos?.size === 1) return { produtoId: [...donos][0], por: "gtin", valor: gtin };
  }

  return null;
}

/** Um anúncio do ML que ainda não é nosso, com o que sabemos sobre ele. */
export interface AnuncioParaAdotar {
  mlbId: string;
  titulo: string;
  permalink: string | null;
  status: string | null;
  categoriaMl: string | null;
  /** Em centavos, para comparar com o catálogo sem float. */
  precoCentavos: number;
  estoque: number;
  temVariacoes: boolean;
  skus: string[];
  casamento: Casamento | null;
  /** O nome do produto casado, para a tela não precisar de outra consulta. */
  produtoNome: string | null;
  /**
   * O que a loja passaria a mandar para o anúncio se ele fosse adotado. É o
   * que transforma "vincular" numa decisão informada em vez de um sim cego.
   */
  mudaria: { precoCentavos: number; estoque: number | null } | null;
}

/** Reais do ML em centavos inteiros, sem escorregar no float. */
const centavos = (v: number | undefined): number => Math.round(Number(v ?? 0) * 100);

/** Monta a proposta de adoção a partir do item e do catálogo. Puro. */
export function proporAdocao(item: ItemDoVendedor, catalogo: ProdutoDoCatalogo[]): AnuncioParaAdotar {
  const casamento = casarAnuncioComCatalogo(item, catalogo);
  const produto = casamento ? catalogo.find((p) => p.produtoId === casamento.produtoId) : undefined;
  return {
    mlbId: item.id,
    titulo: item.title ?? item.id,
    permalink: item.permalink ?? null,
    status: item.status ?? null,
    categoriaMl: item.category_id ?? null,
    precoCentavos: centavos(item.price),
    estoque: Math.trunc(Number(item.available_quantity ?? 0)),
    temVariacoes: Boolean(item.variations?.length),
    skus: skusDoAnuncio(item),
    casamento,
    produtoNome: produto?.nome ?? null,
    mudaria: produto ? { precoCentavos: produto.precoCentavos, estoque: produto.estoque } : null,
  };
}

/** O multiget do ML devolve um envelope por id. */
type RespostaMultiget = Array<{ code?: number; body?: ItemDoVendedor }>;

/** Campos pedidos no multiget: sem isto vem o item inteiro, que é grande. */
const CAMPOS = [
  "id", "title", "price", "available_quantity", "permalink",
  "status", "category_id", "seller_custom_field", "attributes", "variations",
].join(",");

/**
 * Os anúncios do lojista que ainda não estão ligados a produto nenhum.
 *
 * Lê `GET /users/{id}/items/search` (que exige o token de venda — o do
 * Mercado Pago responde 403 aqui, e é por isso que a credencial é separada) e
 * detalha em lotes de 20, que é o teto do multiget.
 *
 * O teto de varredura é de propósito: isto alimenta uma tela, e um vendedor
 * com dois mil anúncios não pode fazer o painel esperar. O que passar do teto
 * fica para a próxima rodada, e o total informado diz que ainda há mais.
 */
export async function listarParaAdotar(
  loja: Tenant,
  opcoes: { limite?: number } = {},
): Promise<{ totalNoMl: number; jaVinculados: number; anuncios: AnuncioParaAdotar[] }> {
  const limite = Math.min(Math.max(opcoes.limite ?? 100, 1), 200);

  const ids: string[] = [];
  let totalNoMl = 0;
  for (let offset = 0; offset < limite; offset += 50) {
    const pagina = await chamarMl<{ results?: string[]; paging?: { total?: number } }>(
      loja,
      `/users/${encodeURIComponent(loja.mlUserId ?? "")}/items/search?status=active&limit=50&offset=${offset}`,
    );
    totalNoMl = pagina.paging?.total ?? totalNoMl;
    const achados = pagina.results ?? [];
    ids.push(...achados);
    if (achados.length < 50) break;
  }

  const nossos = await prisma.anuncioMercadoLivre.findMany({
    where: { tenantId: loja.id, mlbId: { in: ids } },
    select: { mlbId: true },
  });
  const jaTemos = new Set(nossos.map((a) => a.mlbId));
  const faltando = ids.filter((id) => !jaTemos.has(id)).slice(0, limite);

  if (!faltando.length) {
    return { totalNoMl, jaVinculados: jaTemos.size, anuncios: [] };
  }

  const catalogo = await catalogoParaCasar(loja.id);

  const anuncios: AnuncioParaAdotar[] = [];
  for (let i = 0; i < faltando.length; i += 20) {
    const lote = faltando.slice(i, i + 20);
    const resposta = await chamarMl<RespostaMultiget>(loja, `/items?ids=${lote.join(",")}&attributes=${CAMPOS}`);
    for (const envelope of resposta ?? []) {
      if (envelope.code !== 200 || !envelope.body?.id) continue;
      anuncios.push(proporAdocao(envelope.body, catalogo));
    }
  }

  // O que já casou primeiro: é a lista que o lojista resolve num clique. O
  // resto exige decisão por linha, e não pode empurrar isso para o fim da
  // rolagem.
  anuncios.sort((a, b) => Number(Boolean(b.casamento)) - Number(Boolean(a.casamento)));
  return { totalNoMl, jaVinculados: jaTemos.size, anuncios };
}

/** Produtos ativos da loja no formato que o casamento lê. */
async function catalogoParaCasar(tenantId: string): Promise<ProdutoDoCatalogo[]> {
  const produtos = await prisma.produto.findMany({
    where: { tenantId, ativo: true },
    select: {
      id: true, nome: true, sku: true, gtin: true, precoCentavos: true, estoque: true,
      variantes: { where: { ativo: true }, select: { sku: true, gtin: true } },
    },
  });
  return produtos.map((p) => ({
    produtoId: p.id,
    nome: p.nome,
    sku: p.sku,
    gtin: p.gtin,
    precoCentavos: p.precoCentavos,
    estoque: p.estoque,
    variantes: p.variantes,
  }));
}

export class AdocaoRecusada extends Error {}

/**
 * Liga anúncios do ML a produtos da loja, por decisão do lojista.
 *
 * A partir daqui o anúncio é nosso para sincronizar: o ciclo seguinte manda
 * preço e estoque da loja para ele. Título, fotos e descrição **não** — quem
 * escreve isso é o preparo, e anúncio adotado não passou por ele. Reescrever
 * o texto de um anúncio que já vende, sem ninguém pedir, seria a adoção
 * fazendo mais do que foi autorizada a fazer.
 */
export async function vincularAnuncios(
  tenantId: string,
  pares: Array<{ mlbId: string; produtoId: string; categoriaMl?: string | null }>,
): Promise<{ vinculados: number }> {
  if (!pares.length) return { vinculados: 0 };

  const produtoIds = [...new Set(pares.map((p) => p.produtoId))];
  const daLoja = await prisma.produto.findMany({
    where: { tenantId, id: { in: produtoIds } },
    select: { id: true },
  });
  const validos = new Set(daLoja.map((p) => p.id));
  const intruso = pares.find((p) => !validos.has(p.produtoId));
  if (intruso) throw new AdocaoRecusada("Produto não encontrado nesta loja.");

  // Produto que já tem anúncio COM mlbId aponta para outro anúncio no ML.
  // Trocar por baixo do pano deixaria o primeiro órfão e no ar, sem ninguém
  // sincronizando — e o lojista descobriria pelo estoque que não baixa.
  const existentes = await prisma.anuncioMercadoLivre.findMany({
    where: { tenantId, produtoId: { in: produtoIds } },
    select: { produtoId: true, mlbId: true },
  });
  const ocupado = existentes.find((a) => a.mlbId && !pares.some((p) => p.produtoId === a.produtoId && p.mlbId === a.mlbId));
  if (ocupado) {
    throw new AdocaoRecusada(
      `O produto já está ligado ao anúncio ${ocupado.mlbId}. Desvincule lá antes de ligar a outro.`,
    );
  }

  let vinculados = 0;
  for (const par of pares) {
    const comum = {
      mlbId: par.mlbId,
      categoriaMl: par.categoriaMl ?? null,
      estado: "publicado",
      statusMl: "active",
      motivoErro: null,
      // Sem impressão digital de conteúdo: o anúncio adotado tem o texto do
      // lojista, e o ciclo não deve reescrevê-lo. `conteudoDoAnuncio` devolve
      // nulo sem preparo, então só preço e estoque vão daqui para lá.
      conteudoHash: null,
      sincronizadoEm: null,
    };
    await prisma.anuncioMercadoLivre.upsert({
      where: { tenantId_produtoId: { tenantId, produtoId: par.produtoId } },
      create: { tenantId, produtoId: par.produtoId, ...comum },
      update: comum,
    });
    vinculados++;
  }
  return { vinculados };
}
