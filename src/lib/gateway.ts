import type { Tenant } from "@prisma/client";
import { MercadoPagoProvider, type PaymentProvider } from "@avilaops/checkout/server";
import { decifrar } from "./cofre";

/**
 * Provedor de pagamento da loja.
 *
 * Cada loja tem a própria conta no Mercado Pago: o dinheiro cai direto na conta
 * do lojista, sem passar pela Avila Ops (que não é instituição de pagamento). O
 * que é nosso é a tela, o cálculo e a conciliação.
 *
 * **Um gateway só, por decisão de escopo do Nicolas em 31/08/2026.** O código
 * conhece apenas a interface `PaymentProvider`, então acrescentar outro é
 * implementar a interface e trocar o que este arquivo devolve, sem tocar em
 * rota nem em tela. Os adaptadores de PayPal e Éfi seguem no
 * `packages/checkout`, fora do caminho, para o dia em que a decisão mudar.
 */
const BASE_PLATAFORMA = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

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
    // Por cobrança, com `?loja=`: o webhook chega no host da plataforma e acha a
    // loja pelo slug, sem depender da URL cadastrada na aplicação do MP.
    notificationUrl: `https://${BASE_PLATAFORMA}/api/webhooks/mercadopago?loja=${t.slug}`,
  });
}

/** O que o painel mostra sobre o recebimento, sem revelar segredo nenhum. */
export function estadoDoGateway(t: Tenant): { configurado: boolean; pendencia: string | null } {
  if (!t.mpAccessTokenEnc) {
    return { configurado: false, pendencia: "Informe as chaves do Mercado Pago para começar a receber." };
  }
  if (!t.mpWebhookSecretEnc) {
    return {
      configurado: true,
      pendencia: "Falta o segredo do webhook: sem ele o pagamento só é confirmado na verificação periódica.",
    };
  }
  return { configurado: true, pendencia: null };
}
