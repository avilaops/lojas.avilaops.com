import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { prisma } from "@/lib/db";

/**
 * "Leve também" do carrinho. O carrinho vive no navegador, então quem pergunta
 * é o cliente: manda os ids que já tem e recebe até quatro produtos ativos das
 * mesmas categorias, sem repetir o que já está lá.
 *
 * Público de propósito — é o mesmo que qualquer visitante vê na vitrine.
 */
const Entrada = z.object({ ids: z.array(z.string().max(40)).max(50) });

export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return Response.json({ produtos: [] });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });
  const ids = r.data.ids;

  const noCarrinho = ids.length ? await prisma.produto.findMany({ where: { tenantId: t.id, id: { in: ids } }, select: { categoriaId: true } }) : [];
  const categorias = [...new Set(noCarrinho.map((p) => p.categoriaId).filter((c): c is string => Boolean(c)))];

  const comum = { tenantId: t.id, ativo: true, disponibilidade: { not: "out_of_stock" }, id: { notIn: ids } };
  const seleciona = { id: true, slug: true, nome: true, precoCentavos: true, imagens: true } as const;

  // Primeiro o que combina com o carrinho; se a loja ainda tem poucas
  // categorias, completa com os destaques para a área nunca ficar pela metade.
  const daCategoria = categorias.length
    ? await prisma.produto.findMany({ where: { ...comum, categoriaId: { in: categorias } }, select: seleciona, orderBy: [{ destaque: "desc" }, { nome: "asc" }], take: 4 })
    : [];

  const faltam = 4 - daCategoria.length;
  const complemento = faltam > 0
    ? await prisma.produto.findMany({
        where: { ...comum, id: { notIn: [...ids, ...daCategoria.map((p) => p.id)] } },
        select: seleciona,
        orderBy: [{ destaque: "desc" }, { criadoEm: "desc" }],
        take: faltam,
      })
    : [];

  return Response.json({
    produtos: [...daCategoria, ...complemento].map((p) => ({ id: p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] ?? null })),
  });
}
