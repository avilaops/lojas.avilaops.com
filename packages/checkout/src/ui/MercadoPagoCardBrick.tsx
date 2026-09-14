"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatarBRL } from "../core/totais.ts";

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      opcoes?: { locale?: string },
    ) => {
      bricks: () => {
        create: (tipo: string, container: string, config: unknown) => Promise<unknown>;
      };
    };
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
let sdkPromise: Promise<void> | null = null;

/**
 * Carrega o SDK do Mercado Pago uma vez só por página.
 *
 * Sem esse cache, voltar do passo de pagamento e entrar de novo injetaria outra
 * tag <script>, e o brick passaria a ser montado duas vezes no mesmo container.
 */
function carregarSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Não foi possível carregar o Mercado Pago."));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export interface MercadoPagoCardBrickProps {
  /**
   * Chave PÚBLICA do Mercado Pago.
   *
   * É a única credencial do gateway que pode existir no navegador. Ela só
   * tokeniza cartão; não cobra e não estorna. O access token, esse, jamais sai
   * do servidor.
   */
  publicKey: string;
  totalEmCentavos: number;
  emailCliente?: string;
  maxParcelas?: number;
  /** Recebe o token e devolve o pagamento ao fluxo do checkout. */
  aoTokenizar: (dados: {
    token: string;
    parcelas: number;
    bandeira?: string;
  }) => void | Promise<void>;
}

/**
 * Campos de cartão do Mercado Pago (Card Payment Brick).
 *
 * O número do cartão é digitado dentro de iframes do Mercado Pago e vira um
 * token ali mesmo. Nem este componente, nem o nosso servidor, nem o nosso log
 * chegam a ver o PAN , é isso que mantém a operação no escopo leve do PCI-DSS.
 *
 * Fica separado do CheckoutScreen de propósito: a tela não conhece gateway, e
 * quem usa outro provedor pluga outro componente no mesmo espaço.
 */
export default function MercadoPagoCardBrick({
  publicKey,
  totalEmCentavos,
  emailCliente,
  maxParcelas = 12,
  aoTokenizar,
}: MercadoPagoCardBrickProps) {
  const containerId = useRef(`mp-card-brick-${Math.random().toString(36).slice(2)}`);
  const montado = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // `aoTokenizar` numa ref: o brick é montado uma vez e guarda o callback que
  // recebeu. Se ele capturasse a primeira versão da função, chamaria sempre o
  // estado antigo do checkout.
  const callbackRef = useRef(aoTokenizar);
  callbackRef.current = aoTokenizar;

  useEffect(() => {
    if (montado.current) return;
    montado.current = true;

    let cancelado = false;

    void (async () => {
      try {
        await carregarSdk();
        if (cancelado || !window.MercadoPago) return;

        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        await mp.bricks().create("cardPayment", containerId.current, {
          initialization: {
            // O brick trabalha em reais decimais, como a API.
            amount: Number((totalEmCentavos / 100).toFixed(2)),
            ...(emailCliente ? { payer: { email: emailCliente } } : {}),
          },
          customization: {
            paymentMethods: { maxInstallments: maxParcelas },
            visual: { style: { theme: "bootstrap" } },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) setCarregando(false);
            },
            onSubmit: async (dados: {
              formData?: {
                token?: string;
                installments?: number;
                payment_method_id?: string;
              };
            }) => {
              const form = dados?.formData;
              if (!form?.token) {
                setErro("Não foi possível validar o cartão. Confira os dados.");
                return;
              }
              await callbackRef.current({
                token: form.token,
                parcelas: form.installments ?? 1,
                ...(form.payment_method_id ? { bandeira: form.payment_method_id } : {}),
              });
            },
            onError: () => {
              if (!cancelado) {
                setErro("Confira os dados do cartão e tente novamente.");
                setCarregando(false);
              }
            },
          },
        });
      } catch {
        if (!cancelado) {
          setErro("Pagamento com cartão indisponível no momento. Tente o PIX.");
          setCarregando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [publicKey, totalEmCentavos, emailCliente, maxParcelas]);

  return (
    <div>
      {carregando && !erro && (
        <p className="ck-hint">Carregando o formulário seguro de cartão…</p>
      )}
      {erro && (
        <div className="ck-alert ck-alert--erro" role="alert">
          {erro}
        </div>
      )}
      <div id={containerId.current} />
      <p className="ck-hint" style={{ marginTop: "0.75rem" }}>
        Total: {formatarBRL(totalEmCentavos)}. Os dados do cartão são digitados
        em campos do Mercado Pago e não passam pelos nossos servidores.
      </p>
    </div>
  );
}
