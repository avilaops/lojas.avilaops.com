import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";

/**
 * GET /api/painel/busca?q= — a busca do painel (⌘K).
 *
 * Procura no que o lojista precisa achar depressa: um produto pelo nome ou
 * SKU, e um pedido pelo número, pela referência ou por quem comprou. Número
 * puro é tratado como número do pedido, que é como o lojista fala ("o 47").
 *
 * Tudo filtrado por `tenantId` na própria consulta, e o resultado carrega só o
 * que a lista mostra: nada de endereço ou documento saindo por aqui.
 */
export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ produtos: [], pedidos: [] });

  const numero = /^\d+$/.test(q) ? Number(q) : undefined;

  const [produtos, pedidos] = await Promise.all([
    prisma.produto.findMany({
      where: {
        tenantId: loja.id,
        OR: [{ nome: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }],
      },
      select: { id: true, nome: true, sku: true, ativo: true, precoCentavos: true },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      take: 6,
    }),
    prisma.pedido.findMany({
      where: {
        tenantId: loja.id,
        OR: [
          ...(numero !== undefined ? [{ numero }] : []),
          { referencia: { contains: q, mode: "insensitive" as const } },
          { clienteNome: { contains: q, mode: "insensitive" as const } },
          { clienteEmail: { contains: q, mode: "insensitive" as const } },
        ],
      },
      select: { id: true, numero: true, clienteNome: true, status: true, totalCentavos: true },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
  ]);

  return Response.json({ produtos, pedidos });
}
