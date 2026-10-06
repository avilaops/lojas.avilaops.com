/**
 * O índice que liga o domínio da plataforma aos sitemaps das lojas.
 *
 * Sitemap é por host: o `sitemap.xml` de `lojas.avilaops.com` só pode listar
 * páginas da plataforma, e cada loja publica o dela em
 * `<slug>.lojas.avilaops.com/sitemap.xml`. Sem este índice nada no domínio-base
 * apontava para as lojas, e o Search Console da propriedade de domínio via 11
 * endereços num lugar que serve milhares (medido em 06/10/2026).
 *
 * Só entra loja cujo endereço oficial É o subdomínio. Loja com domínio próprio
 * tem `noindex` no subdomínio (ver layout.tsx) e o sitemap dela lista o domínio
 * da marca, que é outra propriedade e se anuncia pelo próprio robots.txt.
 *
 * Sem `next/headers` nem banco aqui: é texto puro, e o teste confere o XML.
 */

export type LojaDoIndice = { slug: string; dominioPrincipal: string | null };

/** Limite do protocolo para um índice de sitemaps. */
export const MAXIMO_DE_SITEMAPS = 50_000;

export function lojasDoIndice<T extends LojaDoIndice>(lojas: T[]): T[] {
  return lojas.filter((l) => !l.dominioPrincipal && /^[a-z0-9-]+$/.test(l.slug)).slice(0, MAXIMO_DE_SITEMAPS);
}

export function indiceDeSitemaps(baseDomain: string, lojas: LojaDoIndice[]): string {
  const itens = lojasDoIndice(lojas)
    .map((l) => `<sitemap><loc>https://${l.slug}.${baseDomain}/sitemap.xml</loc></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}${itens ? "\n" : ""}</sitemapindex>\n`;
}
