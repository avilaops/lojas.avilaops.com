import { prisma } from "./db";
import { slugificar } from "./catalogo";
import { filtroNoAr, resumoDe, type PublicacaoResumo } from "./publicacoes";
import type { PublicacaoLoja } from "@prisma/client";

/**
 * Blog da loja — as consultas.
 *
 * Separado de `publicacoes.ts` porque aquele módulo é lido também pelo painel
 * no navegador. Aqui mora tudo que fala com o banco, e todo caminho passa por
 * `filtroNoAr`: rascunho e post agendado não existem para a vitrine, nem na
 * listagem, nem por URL direta, nem no sitemap.
 */

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

export async function listarPublicadas(tenantId: string, limite = 20, pular = 0): Promise<PublicacaoResumo[]> {
  const posts = await prisma.publicacaoLoja.findMany({
    where: filtroNoAr(tenantId),
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
  return prisma.publicacaoLoja.count({ where: filtroNoAr(tenantId) });
}

export async function publicacaoPorSlug(tenantId: string, slug: string): Promise<PublicacaoLoja | null> {
  return prisma.publicacaoLoja.findFirst({ where: { ...filtroNoAr(tenantId), slug } });
}

