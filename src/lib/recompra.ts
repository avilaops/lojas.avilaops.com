import type { ItemCarrinho } from "@avilaops/checkout";

export interface ItemAnterior {
  id: string;
  produtoId: string | null;
  varianteId: string | null;
  varianteNome: string | null;
  nome: string;
  sku: string | null;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface ItemRecompra {
  linhaId: string;
  nomeAnterior: string;
  quantidade: number;
  precoAnteriorCentavos: number;
  oferta: { id: string; slug: string; nome: string; precoCentavos: number; imagem?: string } | null;
  motivo: string | null;
}

export interface RevisaoRecompra { numero: number; itens: ItemRecompra[] }

/** Uma variante apagada nunca vira a apresentação padrão por engano. */
export function identidadeParaRecompra(item: ItemAnterior): string | null {
  if (!item.produtoId || (!item.varianteId && item.varianteNome) || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 999) return null;
  return item.varianteId ? `${item.produtoId}:${item.varianteId}` : item.produtoId;
}

export function montarRevisaoRecompra(itens: ItemAnterior[], ofertas: ItemCarrinho[], slugs: Map<string, string>): ItemRecompra[] {
  return itens.map(item => {
    const identidade = identidadeParaRecompra(item);
    const atual = identidade ? ofertas.find(o => identidade.includes(":") ? o.id === identidade : o.id.split(":")[0] === identidade) : undefined;
    const slug = item.produtoId ? slugs.get(item.produtoId) : undefined;
    const skuMudou = Boolean(item.sku && atual && item.sku !== atual.sku);
    const disponivel = atual && slug && !skuMudou;
    return {
      linhaId: item.id, nomeAnterior: item.nome, quantidade: item.quantidade,
      precoAnteriorCentavos: item.precoUnitarioCentavos,
      oferta: disponivel ? { id: atual.id, slug, nome: atual.nome, precoCentavos: atual.precoUnitario, imagem: atual.imagem } : null,
      motivo: disponivel ? null : !identidade || skuMudou
        ? "A referência original precisa ser conferida com a loja."
        : "Produto ou quantidade indisponível para compra online. Confira com a loja.",
    };
  });
}
