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
