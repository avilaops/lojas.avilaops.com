import type { Tenant } from "@prisma/client";

/**
 * Os pixels que a loja carrega. Fica fora do componente porque o layout (que é
 * servidor) precisa saber se há rastreio para decidir se pergunta sobre
 * cookies — e função exportada de módulo "use client" não roda no servidor.
 */
export interface PixelsDaLoja {
  gtmId: string | null;
  metaPixelId: string | null;
  ga4Id: string | null;
  googleAdsId: string | null;
  tiktokPixelId: string | null;
  /** Google Avaliações do Consumidor: convite e selo são scripts do Google. */
  googleMerchantId: string | null;
}

export function pixelsDo(t: Tenant): PixelsDaLoja {
  return { gtmId: t.gtmId, metaPixelId: t.metaPixelId, ga4Id: t.ga4Id, googleAdsId: t.googleAdsId, tiktokPixelId: t.tiktokPixelId, googleMerchantId: t.googleMerchantId };
}

/**
 * A tag do site da própria plataforma (lojas.avilaops.com): página inicial,
 * planos, blog, ajuda, entrar e criar loja.
 *
 * Loja guarda os ids em `Tenant`; a plataforma não é loja de ninguém, então o
 * dela vem do ambiente (`PLATAFORMA_GTM_ID`). Vazio ou malformado = sem tag e
 * sem aviso de cookies, que é como o site sempre funcionou. Só o GTM: o que
 * mais for preciso medir se configura dentro do container, não aqui.
 */
export function pixelsDaPlataforma(env: Record<string, string | undefined> = process.env): PixelsDaLoja {
  const gtm = (env.PLATAFORMA_GTM_ID ?? "").trim();
  return {
    gtmId: /^GTM-[A-Z0-9]+$/.test(gtm) ? gtm : null,
    metaPixelId: null,
    ga4Id: null,
    googleAdsId: null,
    tiktokPixelId: null,
    googleMerchantId: null,
  };
}

/** Sem nenhum id não há cookie de terceiro: a loja não precisa pedir consentimento. */
export const temRastreio = (p: PixelsDaLoja) => Boolean(p.gtmId || p.metaPixelId || p.ga4Id || p.googleAdsId || p.tiktokPixelId || p.googleMerchantId);

/**
 * O script em linha que abre o `dataLayer` no HTML da loja com GTM ou gtag.
 *
 * O `consent default` tem de ser o primeiro comando do dataLayer: o GTM e o
 * gtag.js processam a fila em ordem, e um `view_item` enfileirado antes dele
 * chegaria às tags sem o estado `denied`. Por isso ele vai aqui, junto do
 * marcador `__lojaPixels` que `eventos-loja.ts` lê, e não nos loaders
 * `afterInteractive`.
 * `ads_data_redaction`: enquanto o anúncio está negado, o Google também tira
 * os identificadores de clique das URLs que recebe. É o par do Consent Mode v2
 * que a documentação pede junto do `default` negado.
 */
export function scriptInicialDoGoogle(p: Pick<PixelsDaLoja, "gtmId">): string {
  return (
    "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}" +
    "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});" +
    "gtag('set','ads_data_redaction',true);" +
    `window.__lojaPixels={gtm:${p.gtmId ? "true" : "false"}};`
  );
}
