import type { Tenant } from "@prisma/client";
import {
  EfiProvider,
  MercadoPagoProvider,
  PayPalProvider,
  type PaymentProvider,
} from "@avilaops/checkout/server";
import { decifrar } from "./cofre";

/**
 * Provedor de pagamento da loja.
 *
 * Cada loja tem a própria conta no gateway: o dinheiro cai direto na conta do
 * lojista, sem passar pela Avila Ops (que não é instituição de pagamento). O
 * que é nosso é a tela, o cálculo e a conciliação.
 *
 * Os três meios da regra da casa estão ligados. Quem escolhe é a loja, no campo
 * `gateway`; o resto do código só conhece a interface `PaymentProvider` e não
 * muda quando a escolha muda.
 */
const BASE_PLATAFORMA = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

export class GatewayNaoConfigurado extends Error {}

/** Nome que aparece na fatura do comprador. */
function descritor(t: Tenant): string {
  return t.nome.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, 13);
}

/**
 * Endereço da notificação, sempre com `?loja=`.
 *
 * O webhook chega no host da plataforma e acha a loja pelo slug, em vez de
 * depender da URL cadastrada no painel do gateway, que é uma só para a conta
 * inteira e já apontou para host desligado.
 */
function urlDeNotificacao(t: Tenant, gateway: string): string {
  return `https://${BASE_PLATAFORMA}/api/webhooks/${gateway}?loja=${t.slug}`;
}

export function providerDaLoja(t: Tenant): PaymentProvider {
  switch (t.gateway) {
    case "paypal": {
      if (!t.paypalClientId || !t.paypalSecretEnc) {
        throw new GatewayNaoConfigurado(`A loja ${t.slug} escolheu PayPal mas não preencheu as credenciais.`);
      }
      return new PayPalProvider({
        clientId: t.paypalClientId,
        clientSecret: decifrar(t.paypalSecretEnc),
        // Sem `webhookId` o adaptador recusa toda notificação, de propósito: é
        // o que impede alguém de postar "pagou" no endereço público.
        webhookId: t.paypalWebhookId ?? undefined,
        sandbox: t.paypalSandbox,
        moeda: "BRL",
      });
    }

    case "efi": {
      if (!t.efiClientId || !t.efiSecretEnc) {
        throw new GatewayNaoConfigurado(`A loja ${t.slug} escolheu Éfi mas não preencheu as credenciais.`);
      }
      return new EfiProvider({
        clientId: t.efiClientId,
        clientSecret: decifrar(t.efiSecretEnc),
        chavePix: t.efiChavePix ?? undefined,
        webhookToken: t.efiWebhookTokenEnc ? decifrar(t.efiWebhookTokenEnc) : undefined,
        sandbox: t.efiSandbox,
        pixExpiraEmSegundos: 30 * 60,
      });
    }

    default: {
      if (!t.mpAccessTokenEnc) {
        throw new GatewayNaoConfigurado(`A loja ${t.slug} ainda não tem gateway de pagamento configurado.`);
      }
      return new MercadoPagoProvider({
        accessToken: decifrar(t.mpAccessTokenEnc),
        webhookSecret: t.mpWebhookSecretEnc ? decifrar(t.mpWebhookSecretEnc) : undefined,
        descritorFatura: descritor(t),
        pixExpiraEmMinutos: 30,
        notificationUrl: urlDeNotificacao(t, "mercadopago"),
      });
    }
  }
}

/** O que o painel mostra sobre o recebimento, sem revelar segredo nenhum. */
export function estadoDoGateway(t: Tenant): { gateway: string; configurado: boolean; pendencia: string | null } {
  if (t.gateway === "paypal") {
    if (!t.paypalClientId || !t.paypalSecretEnc) {
      return { gateway: "paypal", configurado: false, pendencia: "Informe o client id e o segredo do PayPal." };
    }
    if (!t.paypalWebhookId) {
      return {
        gateway: "paypal",
        configurado: false,
        pendencia: "Falta o ID do webhook do PayPal: sem ele a confirmação de pagamento é recusada.",
      };
    }
    return { gateway: "paypal", configurado: true, pendencia: null };
  }

  if (t.gateway === "efi") {
    if (!t.efiClientId || !t.efiSecretEnc) {
      return { gateway: "efi", configurado: false, pendencia: "Informe o client id e o segredo da Éfi." };
    }
    if (!t.efiChavePix) {
      return { gateway: "efi", configurado: false, pendencia: "Informe a chave Pix que vai receber." };
    }
    return { gateway: "efi", configurado: true, pendencia: null };
  }

  if (!t.mpAccessTokenEnc) {
    return { gateway: "mercadopago", configurado: false, pendencia: "Informe as chaves do Mercado Pago." };
  }
  return { gateway: "mercadopago", configurado: true, pendencia: null };
}
