"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useConsentimento } from "@/lib/consentimento";
import { configurarDestinos } from "@/lib/eventos-loja";
import type { PixelsDaLoja } from "@/lib/pixels";


/**
 * Pixels de anúncio da loja. Cada um é opcional e só é carregado se o lojista
 * tiver colado o id — loja sem anúncio não paga o custo de nenhum script.
 *
 * Nada de terceiro roda antes do comprador responder o aviso de cookies:
 *
 * - Google (GTM/gtag) carrega com o Consent Mode v2 em `denied`, que é o
 *   formato que o próprio Google pede: sem cookie, só ping sem identificação,
 *   e a medição volta inteira no `update` se a pessoa aceitar.
 * - Meta e TikTok não têm equivalente confiável, então o script só é inserido
 *   depois do aceite.
 *
 * Os eventos de compra (ver `src/lib/eventos-loja.ts`) são disparados pelo
 * navegador nas telas de produto, carrinho, checkout e pedido pago. É o mínimo
 * que o Gerenciador de Anúncios precisa para otimizar campanha por conversão.
 */
export default function Pixels({ p }: { p: PixelsDaLoja }) {
  const aceito = useConsentimento() === "aceito";

  // Avisa o Google quando o comprador libera. Roda de novo se ele mudar de
  // ideia no rodapé, sem recarregar a página.
  useEffect(() => {
    if (!aceito) return;
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    w.gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
  }, [aceito]);

  const gtag = p.ga4Id || p.googleAdsId;

  // Diz aos eventos de e-commerce por onde chegar ao Google: só pelo
  // dataLayer do GTM quando não há gtag, pelo gtag quando há. Ver eventos-loja.
  useEffect(() => {
    configurarDestinos({ gtm: Boolean(p.gtmId), gtag: Boolean(gtag) });
  }, [p.gtmId, gtag]);

  const padraoConsentimento =
    "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}" +
    "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});";

  return (
    <>
      {p.gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`${padraoConsentimento}(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${p.gtmId}');`}
        </Script>
      )}

      {gtag && (
        <>
          <Script id="gtag-init" strategy="afterInteractive">
            {`${padraoConsentimento}gtag('js',new Date());${p.ga4Id ? `gtag('config','${p.ga4Id}');` : ""}${p.googleAdsId ? `gtag('config','${p.googleAdsId}');` : ""}`}
          </Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtag}`} strategy="afterInteractive" />
        </>
      )}

      {aceito && p.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${p.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}

      {aceito && p.tiktokPixelId && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(e){for(var n=ttq._i[e]||[],i=0;i<ttq.methods.length;i++)ttq.setAndDefer(n,ttq.methods[i]);return n};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${p.tiktokPixelId}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
    </>
  );
}
