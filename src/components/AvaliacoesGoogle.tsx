"use client";

import Script from "next/script";
import { useConsentimento } from "@/lib/consentimento";
import type { ConviteAvaliacao } from "@/lib/avaliacoes-google";

/**
 * Google Avaliações do Consumidor na vitrine. Os dois são scripts do Google e
 * só entram depois do "aceito" no aviso de cookies: o convite entrega o e-mail
 * do comprador, e o selo carrega de um domínio de terceiro em toda página.
 */

type Gapi = { load: (modulo: string, pronto: () => void) => void; surveyoptin: { render: (dados: Record<string, string>) => void } };

/** Convite na página do pedido pago. O próprio Google pergunta se a pessoa quer avaliar. */
export function ConviteAvaliacaoGoogle({ convite }: { convite: ConviteAvaliacao }) {
  const aceito = useConsentimento() === "aceito";
  if (!aceito) return null;
  return (
    <Script
      id="google-avaliacoes-convite"
      src="https://apis.google.com/js/platform.js"
      strategy="afterInteractive"
      onReady={() => {
        const w = window as Window & { gapi?: Gapi; ___gcfg?: { lang: string } };
        w.___gcfg = { lang: "pt_BR" };
        w.gapi?.load("surveyoptin", () => {
          w.gapi?.surveyoptin.render({
            merchant_id: convite.merchantId,
            order_id: convite.pedido,
            email: convite.email,
            delivery_country: "BR",
            estimated_delivery_date: convite.entregaEstimada,
          });
        });
      }}
    />
  );
}

type Selo = { start: (opcoes: Record<string, string | number>) => void };

/**
 * Selo com a nota da loja. Fica à esquerda porque o WhatsApp ocupa a direita,
 * e sobe no celular para não cobrir a barra de navegação.
 */
export function SeloAvaliacaoGoogle({ merchantId }: { merchantId: string }) {
  const aceito = useConsentimento() === "aceito";
  if (!aceito) return null;
  return (
    <Script
      id="merchantWidgetScript"
      src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
      strategy="lazyOnload"
      onReady={() => {
        (window as Window & { merchantwidget?: Selo }).merchantwidget?.start({
          merchant_id: Number(merchantId),
          position: "BOTTOM_LEFT",
          region: "BR",
          mobileBottomMargin: 76,
        });
      }}
    />
  );
}
