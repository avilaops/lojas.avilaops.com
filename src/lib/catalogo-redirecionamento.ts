import { prisma } from "./db";

/** Preserva links de cadastros arquivados, sem inferir equivalência pelo nome. */
export async function destinoDoProdutoArquivado(tenantId: string, slug: string): Promise<string | null> {
  const inativo = await prisma.produto.findFirst({
    where: { tenantId, slug, ativo: false },
    select: { id: true, sku: true, atributos: true },
  });
  if (!inativo) return null;

  // A equivalência declarada pelo importador mantém precedência. Uma referência
  // explícita sem destino ativo não autoriza escolher outro produto.
  const alvo = (inativo.atributos as Record<string, unknown> | null)?.equivalenteA;
  if (typeof alvo === "string" && alvo.trim()) {
    const ativo = await prisma.produto.findFirst({
      where: { tenantId, sku: alvo.trim(), ativo: true },
      select: { slug: true },
    });
    return ativo && ativo.slug !== slug ? `/produtos/${ativo.slug}` : null;
  }

  // Ao agrupar apresentações, a variante conserva o SKU e muda de produto.
  // O SKU é único por loja na tabela Variante: o link escolhe o mesmo volume.
  if (!inativo.sku?.trim()) return null;
  const variante = await prisma.variante.findFirst({
    where: {
      tenantId, sku: inativo.sku, ativo: true,
      produtoId: { not: inativo.id },
      produto: { tenantId, ativo: true },
    },
    select: { id: true, produto: { select: { slug: true } } },
  });
  if (!variante || variante.produto.slug === slug) return null;
  const query = new URLSearchParams({ variante: variante.id });
  return `/produtos/${variante.produto.slug}?${query}`;
}
