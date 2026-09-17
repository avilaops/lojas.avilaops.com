import type { PublicacaoLoja } from "@prisma/client";

/**
 * Blog da loja — o que é texto puro.
 *
 * Este módulo não toca no banco de propósito: a tela de publicações do painel
 * é componente de cliente e lê `resumoDe` e `minutosDeLeitura` daqui. Se a
 * consulta morasse junto, importar o resumo arrastaria o Prisma para o
 * navegador e o build pararia. As consultas estão em `publicacoes-consulta.ts`.
 *
 * Não confundir com `src/lib/blog.ts`, que é o blog da plataforma: aquele é
 * arquivo em disco, escrito por nós, e vive em lojas.avilaops.com/blog. Este é
 * do lojista, vive no domínio dele e é escopo de tenant em toda consulta — o
 * conteúdo de uma loja nunca aparece na outra, nem no sitemap.
 *
 * Por que uma loja quer isto: a maior parte do tráfego de busca de uma loja
 * pequena não entra pela página do produto, entra por pergunta ("com que
 * frequência trocar o óleo da moto", "qual a diferença entre genérico e
 * similar"). Sem um lugar para responder, a loja só tem páginas que pedem
 * compra, e nenhuma que responda.
 *
 * Duas decisões:
 *
 * - **Corpo é texto, não HTML.** O que o lojista escreve é impresso como
 *   texto, com linha em branco separando parágrafo. HTML colado do Word não
 *   vira marcação, e nada que ele cole pode executar na loja dele.
 * - **Rascunho não existe para a vitrine.** Nem por URL direta, nem no
 *   sitemap: é o que permite escrever em várias sessões sem publicar pela
 *   metade.
 */

export type EstadoPublicacao = "rascunho" | "publicada";

/** Resumo para a listagem: o corpo inteiro não precisa trafegar. */
export interface PublicacaoResumo {
  slug: string;
  titulo: string;
  resumo: string;
  capaUrl: string | null;
  autor: string | null;
  publicadoEm: Date;
}

/**
 * Chamada da listagem.
 *
 * Sem resumo escrito, corta o corpo no fim de uma frase — e não no meio de uma
 * palavra com reticências, que é o que a maioria dos blogs faz e que sempre
 * parece defeito.
 */
export function resumoDe(p: Pick<PublicacaoLoja, "resumo" | "corpo">, limite = 200): string {
  const escrito = (p.resumo ?? "").trim();
  if (escrito) return escrito;

  const texto = p.corpo.replace(/\s+/g, " ").trim();
  if (texto.length <= limite) return texto;

  const pedaco = texto.slice(0, limite);
  const fim = Math.max(pedaco.lastIndexOf(". "), pedaco.lastIndexOf("! "), pedaco.lastIndexOf("? "));
  // Só corta na frase se ela não for curta demais: metade do limite. Senão a
  // chamada vira uma linha solta que não diz do que o texto trata.
  if (fim > limite / 2) return pedaco.slice(0, fim + 1).trim();
  const espaco = pedaco.lastIndexOf(" ");
  return `${(espaco > 0 ? pedaco.slice(0, espaco) : pedaco).trim()}…`;
}

/** Corpo → parágrafos. Mesma regra das políticas: texto, nunca marcação. */
export function emParagrafos(corpo: string): string[] {
  return corpo
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Minutos de leitura, a 200 palavras por minuto.
 *
 * Mínimo de 1: "0 min de leitura" numa nota curta parece erro de conta.
 */
export function minutosDeLeitura(corpo: string): number {
  const palavras = corpo.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/** Data como a loja mostra: "17 de setembro de 2026". */
export function dataLegivel(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}

/**
 * O filtro que a vitrine usa, escrito uma vez.
 *
 * `publicadoEm <= agora` e não só `estado = publicada`: post agendado para
 * amanhã está publicado do ponto de vista do lojista e ainda não existe para o
 * cliente. Ter a condição em dois lugares (listagem e página) seria ter duas
 * verdades sobre quando um texto vai ao ar.
 *
 * Objeto simples, sem importar o Prisma: é o que permite a regra morar no
 * módulo puro, junto do resto do que o blog significa.
 */
export function filtroNoAr(tenantId: string) {
  return { tenantId, estado: "publicada", publicadoEm: { not: null, lte: new Date() } } as const;
}
