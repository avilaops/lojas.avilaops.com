import type { Prisma } from "@prisma/client";

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
 * Cinco perguntas, cada uma com uma resposta:
 *
 *   sobConsulta       não tem preço; existe para ser encontrado e negociado
 *   emEstoque         a loja diz que tem
 *   compravel         entra no carrinho (ativo, com preço, com estoque)
 *   publicavel        vale uma página pública, no sitemap e sem noindex
 *   elegivelMerchant  o Google aceitaria (foto e preço são obrigatórios lá)
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

/** Marcado como esgotado, ou com contagem zerada. É o selo do card. */
export function esgotado(p: Pick<ProdutoRegras, "disponibilidade" | "estoque">): boolean {
  return p.disponibilidade === "out_of_stock" || p.estoque === 0;
}

/** Vai acabar: o aviso "últimas unidades" do card. */
export function estoqueBaixo(p: Pick<ProdutoRegras, "estoque">, limite = 3): boolean {
  return p.estoque != null && p.estoque > 0 && p.estoque <= limite;
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

/** O Google Merchant exige imagem e preço; sem eles o item é reprovado. */
export function elegivelMerchant(p: Pick<ProdutoRegras, "ativo" | "imagens" | "precoCentavos">, imagemDeVariante = false): boolean {
  return p.ativo && (p.imagens.length > 0 || imagemDeVariante) && p.precoCentavos > 0;
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

/** `compravel`, na forma que o Prisma entende (sem a quantidade). */
export const WHERE_COMPRAVEL: Prisma.ProdutoWhereInput = {
  ativo: true,
  precoCentavos: { gt: 0 },
  disponibilidade: { not: "out_of_stock" },
  OR: [{ estoque: null }, { estoque: { gt: 0 } }],
};

/** Foto E preço: o que a primeira vitrine pede antes de completar com o resto. */
export const WHERE_COMPLETO: Prisma.ProdutoWhereInput = {
  ativo: true,
  imagens: { isEmpty: false },
  precoCentavos: { gt: 0 },
};
