import { disponibilidadeSchema } from "./produto-regras";

type Oferta = {
  id?: string;
  padrao?: boolean;
  sku?: string | null;
  precoCentavos: number;
  precoDeCentavos: number | null;
  disponibilidade: string;
  estoque: number | null;
};

export function ofertaMerchant(
  produto: Oferta,
  url: string,
  organizacao: string,
  politica: { "@id": string },
  somenteNaLoja: boolean,
) {
  if (!Number.isSafeInteger(produto.precoCentavos) || produto.precoCentavos <= 0) return undefined;
  const anterior = produto.precoDeCentavos;
  return {
    "@type": "Offer",
    url,
    priceCurrency: "BRL",
    price: (produto.precoCentavos / 100).toFixed(2),
    ...(anterior != null && Number.isSafeInteger(anterior) && anterior > produto.precoCentavos ? {
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/StrikethroughPrice",
        price: (anterior / 100).toFixed(2),
        priceCurrency: "BRL",
      },
    } : {}),
    ...(produto.sku && !/\s/u.test(produto.sku) ? { sku: produto.sku } : {}),
    itemCondition: "https://schema.org/NewCondition",
    availability: somenteNaLoja ? "https://schema.org/InStoreOnly" : `https://schema.org/${disponibilidadeSchema(produto)}`,
    seller: { "@id": organizacao },
    hasMerchantReturnPolicy: politica,
  };
}

export function imagensMerchant(imagens: readonly string[], base: string): string[] {
  const urls = new Set<string>();
  for (const imagem of imagens) {
    if (!imagem.trim()) continue;
    try {
      const url = new URL(imagem, base);
      if (url.protocol === "https:" || url.protocol === "http:") urls.add(url.href);
    } catch { continue; }
  }
  return [...urls];
}
