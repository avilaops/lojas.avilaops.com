import type { Metadata } from "next";

/**
 * O que o Google pode indexar numa listagem de catálogo.
 *
 * Uma listagem tem três dimensões que viram URL: a página, os filtros e a
 * busca. Sem regra, cada combinação é uma URL indexável, e com dez filtros e
 * cem páginas o espaço é infinito: o Google gasta o orçamento de rastreio em
 * "?ordem=nome&min=10&pagina=37" e nunca chega no produto.
 *
 *   /produtos                       indexável, canonical dela mesma
 *   /produtos?pagina=3              indexável, canonical dela mesma: é o
 *                                   caminho por onde o Google descobre o
 *                                   produto da página 3
 *   /produtos?pagina=1              a mesma coisa que /produtos; canonical
 *                                   aponta para /produtos
 *   /produtos?q=... ou ?min=...     noindex, follow: o resultado é útil para
 *                                   quem filtrou, não para o índice, mas os
 *                                   links dentro dele continuam valendo
 *
 * `pagina` é o único parâmetro que sobrevive no canonical. O resto é
 * estado de quem está olhando.
 */
export function metadataDeListagem(opcoes: {
  /** Caminho sem query: "/produtos", "/categoria/retentor". */
  base: string;
  sp: Record<string, string | undefined>;
  pagina: number;
  title: string;
  description?: string;
  keywords?: string[];
}): Metadata {
  const filtrando = Object.entries(opcoes.sp).some(([k, v]) => k !== "pagina" && Boolean(v));
  const canonical = opcoes.pagina > 1 ? `${opcoes.base}?pagina=${opcoes.pagina}` : opcoes.base;

  return {
    title: opcoes.pagina > 1 ? `${opcoes.title} · página ${opcoes.pagina}` : opcoes.title,
    description: opcoes.description,
    keywords: opcoes.keywords,
    alternates: { canonical },
    ...(filtrando ? { robots: { index: false, follow: true } } : {}),
  };
}
