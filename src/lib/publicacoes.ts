import type { PublicacaoLoja } from "@prisma/client";
import { prisma } from "./db";
import { slugificar } from "./catalogo";

/**
 * Blog da loja.
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

/**
 * Título → slug livre nesta loja.
 *
 * O sufixo numérico existe porque dois posts com o mesmo título são comuns
 * ("Novidades de dezembro"), e a alternativa — recusar o segundo — obrigaria o
 * lojista a inventar título para agradar o banco.
 */
export async function slugLivre(tenantId: string, titulo: string, ignorarId: string | null = null): Promise<string> {
  const base = slugificar(titulo) || "publicacao";
  for (let n = 0; n < 50; n++) {
    const tentativa = n === 0 ? base : `${base}-${n + 1}`;
    const existe = await prisma.publicacaoLoja.findFirst({
      where: { tenantId, slug: tentativa, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
      select: { id: true },
    });
    if (!existe) return tentativa;
  }
  return `${base}-${Date.now()}`;
}

// ── Leitura pública ─────────────────────────────────────────────────────

/**
 * O filtro que a vitrine usa, escrito uma vez.
 *
 * `publicadoEm <= agora` e não só `estado = publicada`: post agendado para
 * amanhã está publicado do ponto de vista do lojista e ainda não existe para o
 * cliente. Ter a condição em dois lugares (listagem e página) seria ter duas
 * verdades sobre quando um texto vai ao ar.
 */
function noAr(tenantId: string) {
  return { tenantId, estado: "publicada", publicadoEm: { not: null, lte: new Date() } } as const;
}

export async function listarPublicadas(tenantId: string, limite = 20, pular = 0): Promise<PublicacaoResumo[]> {
  const posts = await prisma.publicacaoLoja.findMany({
    where: noAr(tenantId),
    orderBy: { publicadoEm: "desc" },
    take: limite,
    skip: pular,
    select: { slug: true, titulo: true, resumo: true, corpo: true, capaUrl: true, autor: true, publicadoEm: true },
  });
  return posts.map((p) => ({
    slug: p.slug,
    titulo: p.titulo,
    resumo: resumoDe(p),
    capaUrl: p.capaUrl,
    autor: p.autor,
    publicadoEm: p.publicadoEm!,
  }));
}

export async function contarPublicadas(tenantId: string): Promise<number> {
  return prisma.publicacaoLoja.count({ where: noAr(tenantId) });
}

export async function publicacaoPorSlug(tenantId: string, slug: string): Promise<PublicacaoLoja | null> {
  return prisma.publicacaoLoja.findFirst({ where: { ...noAr(tenantId), slug } });
}

/** Data como a loja mostra: "17 de setembro de 2026". */
export function dataLegivel(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}
