import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";
import { termosDeBusca } from "@/lib/catalogo";

/**
 * Sugestões enquanto a pessoa digita. Usa a mesma coluna normalizada da busca
 * da vitrine (`Produto.busca`, mantida por gatilho), então "valvula" acha
 * "Válvula" aqui também — não adianta a busca da listagem ignorar acento se o
 * caminho mais usado, o campo do topo, não ignorar.
 */
export async function GET(request: Request) {
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return Response.json({ produtos: [], categorias: [] });

  const termos = termosDeBusca(new URL(request.url).searchParams.get("q") ?? "");
  if (!termos.length) return Response.json({ produtos: [], categorias: [] });

  const [produtos, categorias] = await Promise.all([
    prisma.produto.findMany({
      where: { tenantId: t.id, ativo: true, AND: termos.map((termo) => ({ busca: { contains: termo } })) },
      select: { slug: true, nome: true, precoCentavos: true, imagens: true, disponibilidade: true },
      orderBy: [{ destaque: "desc" }, { nome: "asc" }],
      take: 6,
    }),
    prisma.categoria.findMany({
      // Mesma regra da vitrine: não sugerir categoria sem produto ativo.
      where: { tenantId: t.id, nome: { contains: termos[0], mode: "insensitive" }, produtos: { some: { ativo: true } } },
      select: { slug: true, nome: true },
      take: 3,
    }),
  ]);

  return Response.json({
    produtos: produtos.map((p) => ({ slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] ?? null, esgotado: p.disponibilidade === "out_of_stock" })),
    categorias,
  });
}
