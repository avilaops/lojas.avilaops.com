import type { Prisma } from "@prisma/client";
import { lerTarja, vendaRemotaProibida } from "./farmacia";

/**
 * O que um produto pode fazer na vitrine: as regras, num lugar só.
 *
 * Antes cada tela decidia sozinha. O card dizia "esgotado" olhando
 * `disponibilidade` E `estoque`; a página do produto olhava só
 * `disponibilidade` e oferecia "Comprar" para peça com estoque zero (o
 * checkout recusava depois, e o comprador não entendia por quê). O feed do
 * Merchant repetia a conta duas vezes dentro do mesmo arquivo. Com dez mil
 * produtos essas diferenças deixam de ser detalhe: viram o produto que o
 * Google anuncia e a loja não vende.
 *
 * Seis perguntas, cada uma com uma resposta:
 *
 *   sobConsulta           não tem preço; existe para ser encontrado e negociado
 *   emEstoque             a loja diz que tem
 *   compravel             entra no carrinho (ativo, com preço, com estoque)
 *   publicavel            vale uma página pública, no sitemap e sem noindex
 *   elegivelMerchant      o Google aceitaria (foto e preço são obrigatórios lá)
 *   dispensavelADistancia a lei deixa sair pela internet (farmácia)
 *
 * Tudo puro, sem Prisma e sem React: serve ao servidor, ao card e ao teste.
 * Os fragmentos `WHERE_*` são a mesma regra na forma que o banco entende,
 * para a consulta não trazer o que a tela ia descartar.
 */

export type Disponibilidade = "in_stock" | "out_of_stock" | "backorder";

export interface ProdutoRegras {
  ativo: boolean;
  precoCentavos: number;
  imagens: string[];
  disponibilidade: string;
  estoque: number | null;
}

/** Sem preço: "Preço sob consulta". A loja mostra, o WhatsApp negocia. */
export function sobConsulta(p: Pick<ProdutoRegras, "precoCentavos">): boolean {
  return p.precoCentavos <= 0;
}

/** A loja diz que tem: não marcado como esgotado e, se controla estoque, com saldo. */
export function emEstoque(p: Pick<ProdutoRegras, "disponibilidade" | "estoque">): boolean {
  return p.disponibilidade !== "out_of_stock" && (p.estoque == null || p.estoque > 0);
}

/**
 * Marcado como esgotado, ou com contagem zerada (ou negativa, que o ERP grava
 * quando vende além do saldo). É o complemento exato de `emEstoque`: o selo
 * do card e o `availability` do JSON-LD não podem discordar.
 */
export function esgotado(p: Pick<ProdutoRegras, "disponibilidade" | "estoque">): boolean {
  return !emEstoque(p);
}

/** Vai acabar: o aviso "últimas unidades" do card. */
export function estoqueBaixo(p: Pick<ProdutoRegras, "estoque"> & Partial<Pick<ProdutoRegras, "disponibilidade">>, limite = 3): boolean {
  // Marcado como esgotado com saldo no ERP (venda bloqueada): o selo diz
  // "Esgotado", e "últimas unidades" ao lado seria contradição.
  return p.disponibilidade !== "out_of_stock" && p.estoque != null && p.estoque > 0 && p.estoque <= limite;
}

/** Entra no carrinho. O checkout confere de novo, com a quantidade. */
export function compravel(p: Pick<ProdutoRegras, "ativo" | "precoCentavos" | "disponibilidade" | "estoque">): boolean {
  return p.ativo && !sobConsulta(p) && emEstoque(p);
}

/**
 * Vale uma página pública: no sitemap, sem noindex, na primeira vitrine.
 *
 * Foto OU preço basta. Sem os dois é cadastro de referência: nome e ficha,
 * sem nada para o Google exibir nem para o comprador decidir. Continua
 * acessível pela busca da loja, onde quem sabe o código vai procurá-lo.
 */
export function publicavel(p: Pick<ProdutoRegras, "ativo" | "imagens" | "precoCentavos">): boolean {
  return p.ativo && (p.imagens.length > 0 || p.precoCentavos > 0);
}

/** A mesma régua de `publicavel`, como filtro de consulta. Mudou uma, muda a outra. */
export const CONDICAO_PUBLICAVEL = {
  ativo: true,
  OR: [{ NOT: { imagens: { isEmpty: true } } }, { precoCentavos: { gt: 0 } }],
};

/**
 * Oferta de verdade: preço "de" maior que o preço, com foto própria e à venda.
 *
 * É o que a página `/promocoes` lista. A mesma pergunta decide três coisas que
 * já discordaram entre si: se a página entra no sitemap, se o menu mostra
 * "Promoções" e o que a própria página exibe. Foto representativa ou
 * ilustração não entra: o desconto é anunciado sobre o item que a foto mostra.
 */
export function emPromocao(
  p: Pick<ProdutoRegras, "ativo" | "precoCentavos" | "imagens" | "disponibilidade" | "estoque"> & { precoDeCentavos: number | null; imagemOrigem: string | null },
): boolean {
  return publicavel(p)
    && p.precoCentavos > 0
    && p.precoDeCentavos != null
    && p.precoDeCentavos > p.precoCentavos
    && p.imagens.length > 0
    && p.imagemOrigem === "propria"
    && emEstoque(p);
}

/** O Google Merchant exige imagem e preço; sem eles o item é reprovado. */
export function elegivelMerchant(p: Pick<ProdutoRegras, "ativo" | "imagens" | "precoCentavos">, imagemDeVariante = false): boolean {
  return p.ativo && (p.imagens.length > 0 || imagemDeVariante) && p.precoCentavos > 0;
}

/**
 * O que a vitrine diz e oferece para um produto: selo, linha de
 * disponibilidade e a ação do botão, numa resposta só.
 *
 * Antes cada tela montava a sua frase. O card dizia "Esgotado" e oferecia
 * "Consultar preço" para item sem preço e sem estoque; a página do mesmo
 * item não dizia se havia estoque; a sugestão da busca olhava só
 * `disponibilidade` e anunciava preço de peça com contagem zerada. Três
 * telas, três respostas para o mesmo cadastro.
 *
 * A precedência é o que resolve os conflitos:
 *
 *   1. esgotado vence tudo: não há pedido nem consulta de preço, só aviso de
 *      reposição — perguntar o preço do que não existe é pedir o que a loja
 *      não pode entregar;
 *   2. sem preço, com estoque: consulta de preço;
 *   3. com preço e estoque: carrinho quando a loja vende, senão pedido pelo
 *      WhatsApp.
 */
export type AcaoDeVenda = "carrinho" | "pedido" | "consulta-preco" | "aviso-reposicao";

export interface EstadoDeVenda {
  esgotado: boolean;
  /** Linha curta de disponibilidade, igual no card, na página e na busca. */
  disponibilidade: "Indisponível no momento" | "Sob encomenda" | "Em estoque" | "Disponível para compra";
  acao: AcaoDeVenda;
}

export function estadoDeVenda(
  p: Pick<ProdutoRegras, "ativo" | "precoCentavos" | "disponibilidade" | "estoque">,
  loja: { vende: boolean },
): EstadoDeVenda {
  if (!p.ativo || esgotado(p)) return { esgotado: true, disponibilidade: "Indisponível no momento", acao: "aviso-reposicao" };
  const disponibilidade = p.disponibilidade === "backorder" ? "Sob encomenda" : p.estoque == null ? "Disponível para compra" : "Em estoque";
  if (sobConsulta(p)) return { esgotado: false, disponibilidade, acao: "consulta-preco" };
  return { esgotado: false, disponibilidade, acao: loja.vende ? "carrinho" : "pedido" };
}

/** O valor de `g:availability` do Merchant para este produto. */
export function disponibilidadeMerchant(p: Pick<ProdutoRegras, "disponibilidade" | "estoque">): Disponibilidade {
  if (emEstoque(p)) return "in_stock";
  return p.disponibilidade === "backorder" ? "backorder" : "out_of_stock";
}

/** O valor de `schema.org/Offer.availability`. */
export function disponibilidadeSchema(p: Pick<ProdutoRegras, "disponibilidade" | "estoque">): "InStock" | "BackOrder" | "OutOfStock" {
  const d = disponibilidadeMerchant(p);
  return d === "in_stock" ? "InStock" : d === "backorder" ? "BackOrder" : "OutOfStock";
}

/**
 * Pode ser dispensado a distância?
 *
 * Medicamento sob controle especial (tarja preta, tarja vermelha com retenção)
 * não pode: RDC 44/2009, art. 62. É a única regra daqui que não fala de
 * estoque nem de preço — fala do que a lei permite —, e por isso vale nos dois
 * lados. A tela esconde o botão; o servidor recusa o item mesmo que alguém
 * poste o id direto no checkout, que é onde esconder o botão não adianta.
 *
 * Fica separada de `compravel` de propósito: um item barrado aqui continua
 * ativo, com preço e com estoque. O que ele não pode é sair pela internet.
 */
export function dispensavelADistancia(p: { tarja?: string | null }): boolean {
  return !vendaRemotaProibida(lerTarja(p.tarja));
}

/** `compravel`, na forma que o Prisma entende (sem a quantidade). */
export const WHERE_COMPRAVEL: Prisma.ProdutoWhereInput = {
  ativo: true,
  precoCentavos: { gt: 0 },
  disponibilidade: { not: "out_of_stock" },
  OR: [{ estoque: null }, { estoque: { gt: 0 } }],
};

/** `emEstoque`, na forma que o Prisma entende: o filtro "só disponíveis". */
export const WHERE_EM_ESTOQUE: Prisma.ProdutoWhereInput = {
  disponibilidade: { not: "out_of_stock" },
  OR: [{ estoque: null }, { estoque: { gt: 0 } }],
};

/** Foto E preço: o que a primeira vitrine pede antes de completar com o resto. */
export const WHERE_COMPLETO: Prisma.ProdutoWhereInput = {
  ativo: true,
  imagens: { isEmpty: false },
  precoCentavos: { gt: 0 },
};
