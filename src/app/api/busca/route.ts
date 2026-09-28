import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";
import { termosDeBusca, listarProdutos } from "@/lib/catalogo";
import { esgotado } from "@/lib/produto-regras";

/**
 * Sugestões enquanto a pessoa digita. Usa a mesma coluna normalizada da busca
 * da vitrine (`Produto.busca`, mantida por gatilho), então "valvula" acha
 * "Válvula" aqui também — não adianta a busca da listagem ignorar acento se o
 * caminho mais usado, o campo do topo, não ignorar.
 */
export async function GET(request: Request) {
  const t = await tenantAtual();
  if (!t || !["ATIVA", "SUSPENSA"].includes(t.status)) return Response.json({ produtos: [], categorias: [] });

  const consulta = new URL(request.url).searchParams.get("q") ?? "";
  const termos = termosDeBusca(consulta);
  if (!termos.length) return Response.json({ produtos: [], categorias: [] });

  const [produtos, categorias] = await Promise.all([
    listarProdutos(t.id, { busca: consulta, limite: 6 }),
    prisma.categoria.findMany({
      // Mesma regra da vitrine: não sugerir categoria sem produto ativo.
      where: { tenantId: t.id, nome: { contains: termos[0], mode: "insensitive" }, produtos: { some: { ativo: true } } },
      select: { slug: true, nome: true },
      take: 3,
    }),
  ]);

  return Response.json({
    produtos: produtos.map((p) => ({ slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] ?? null, esgotado: esgotado(p) })),
    categorias,
  });
}
