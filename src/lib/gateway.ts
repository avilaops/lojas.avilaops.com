import type { Tenant } from "@prisma/client";
import { MercadoPagoProvider, type PaymentProvider } from "@avilaops/checkout/server";
import { decifrar } from "./cofre";

/**
 * Provedor de pagamento da loja.
 *
 * Cada loja tem a própria conta no gateway — o dinheiro cai direto na conta do
 * lojista, sem passar pela Avila Ops (que não é instituição de pagamento). O
 * que é nosso é a tela, o cálculo e a conciliação.
 *
 * Hoje só Mercado Pago tem adaptador no pacote; PayPal e Éfi entram aqui
 * quando o pacote ganhar os adaptadores, sem tocar nas rotas.
 */
export class GatewayNaoConfigurado extends Error {}

export function providerDaLoja(t: Tenant): PaymentProvider {
  if (!t.mpAccessTokenEnc) {
    throw new GatewayNaoConfigurado(`A loja ${t.slug} ainda não tem gateway de pagamento configurado.`);
  }
  return new MercadoPagoProvider({
    accessToken: decifrar(t.mpAccessTokenEnc),
    webhookSecret: t.mpWebhookSecretEnc ? decifrar(t.mpWebhookSecretEnc) : undefined,
    descritorFatura: t.nome.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, 13),
    pixExpiraEmMinutos: 30,
  });
}
