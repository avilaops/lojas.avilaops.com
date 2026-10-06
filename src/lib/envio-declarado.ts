import type { Tenant } from "@prisma/client";

/**
 * O frete que a loja pode afirmar FORA do checkout: no JSON-LD do produto e no
 * feed do Merchant.
 *
 * O frete de verdade é cotado por CEP (`src/lib/frete.ts`), então quase nunca
 * existe um preço único para o Brasil. O único caso em que existe é o "frete
 * grátis acima de X": produto que sozinho já passa do valor sai de graça para
 * qualquer CEP que a loja atende. Fora dele não se declara nada — valor
 * chutado aqui vira "preço de frete divergente" no Merchant Center, que é pior
 * do que sinal ausente.
 */
type LojaEnvio = Pick<Tenant, "cepOrigem" | "tabelaFrete" | "freteGratisAcima" | "despachoDiasUteis">;

/** A loja cota para o país inteiro: origem para a transportadora, ou faixa "resto do Brasil" na tabela. */
function enviaParaOBrasil(t: LojaEnvio): boolean {
  if ((t.cepOrigem ?? "").replace(/\D/g, "").length === 8) return true;
  const tabela = Array.isArray(t.tabelaFrete) ? (t.tabelaFrete as Array<{ ufs?: unknown }>) : [];
  return tabela.some((f) => Array.isArray(f?.ufs) && f.ufs.includes("*"));
}

export function freteGratisGarantido(t: LojaEnvio, precoCentavos: number): boolean {
  return t.freteGratisAcima != null && precoCentavos > 0 && precoCentavos >= t.freteGratisAcima && enviaParaOBrasil(t);
}

/** `OfferShippingDetails` da oferta, ou nada quando o frete depende do CEP. */
export function envioSchema(t: LojaEnvio, precoCentavos: number) {
  if (!freteGratisGarantido(t, precoCentavos)) return undefined;
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: "0.00", currency: "BRL" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
    // Só o despacho, que é da loja. O trânsito é da transportadora e muda com
    // o CEP: não entra.
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: Math.max(0, t.despachoDiasUteis), unitCode: "DAY" },
    },
  };
}
