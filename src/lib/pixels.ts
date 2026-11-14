import type { Tenant } from "@prisma/client";
import { CHAVE, VERSAO } from "./consentimento-config";

/**
 * Os pixels que a loja carrega. Fica fora do componente porque o layout (que é
 * servidor) precisa saber se há rastreio para decidir se pergunta sobre
 * cookies — e função exportada de módulo "use client" não roda no servidor.
 */
export interface PixelsDaLoja {
  /** Caminho reservado no próprio domínio, somente após configurar o Gateway. */
  googleTagGatewayPath?: string;
  gtmId: string | null;
  metaPixelId: string | null;
  ga4Id: string | null;
  googleAdsId: string | null;
  tiktokPixelId: string | null;
  /** Google Avaliações do Consumidor: convite e selo são scripts do Google. */
  googleMerchantId: string | null;
}

export function pixelsDo(t: Tenant, hostname?: string): PixelsDaLoja {
  const gateway = caminhoDoGatewayGoogle(hostname ?? "");
  return { gtmId: t.gtmId, metaPixelId: t.metaPixelId, ga4Id: t.ga4Id, googleAdsId: t.googleAdsId, tiktokPixelId: t.tiktokPixelId, googleMerchantId: t.googleMerchantId, ...(gateway ? { googleTagGatewayPath: gateway } : {}) };
}

/** Configuração operacional da zona da plataforma; domínios de clientes são independentes. */
export function caminhoDoGatewayGoogle(hostname: string, env: Record<string, string | undefined> = process.env): string | null {
  const caminho = (env.GOOGLE_TAG_GATEWAY_LOJAS_PATH ?? "").trim().replace(/\/+$/, "");
  if (!/^\/[a-zA-Z0-9]{1,98}$/.test(caminho)) return null;
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  const loja = host === "lojas.avilaops.com" || /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.lojas\.avilaops\.com$/.test(host);
  return loja ? `${caminho}/` : null;
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
  const gateway = caminhoDoGatewayGoogle("lojas.avilaops.com", env);
  return {
    gtmId: /^GTM-[A-Z0-9]+$/.test(gtm) ? gtm : null,
    metaPixelId: null,
    ga4Id: null,
    googleAdsId: null,
    tiktokPixelId: null,
    googleMerchantId: null,
    ...(gateway ? { googleTagGatewayPath: gateway } : {}),
  };
}

/** O ID explícito evita carregar o contêiner geral configurado na zona. */
export function scriptDoGtm(p: Pick<PixelsDaLoja, "gtmId" | "googleTagGatewayPath">): string {
  if (!p.gtmId) return "";
  const origem = p.googleTagGatewayPath ?? "https://www.googletagmanager.com/gtm.js";
  const src = `${origem}?id=${encodeURIComponent(p.gtmId)}`;
  const direto = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(p.gtmId)}`;
  // Um script que já iniciou precisa de outro elemento após falhar. A fila
  // permanece intacta, com um só gtm.js, e a tentativa direta não tem ciclo.
  const recuperar = p.googleTagGatewayPath ? `j.onerror=function(){j.onerror=null;var b=d.createElement(s);b.async=true;b.src=${JSON.stringify(direto)}+dl;f.parentNode.insertBefore(b,f);};` : "";
  return `(function(w,d,s,l,u){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;${recuperar}j.src=u+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(src)});`;
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
    // O Gateway pode carregar antes da hidratação. Só o aceite vigente já
    // registrado libera a coleta; storage indisponível mantém o default.
    `(function(){try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(CHAVE)})||"null");if(c&&c.versao===${VERSAO}&&c.escolha==="aceito")gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}catch(e){}})();` +
    `window.__lojaPixels={gtm:${p.gtmId ? "true" : "false"}};`
  );
}
