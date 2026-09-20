import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { slugificar } from "@/lib/catalogo";

const Entrada = z.object({
  movimentos: z.array(z.object({
    origemId: z.string().min(1).max(40),
    destinoId: z.string().min(1).max(40),
  })).min(1).max(50),
});

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Move products from duplicate categories while preserving the canonical
 * category, its SEO fields, image and slug. The source category is kept empty
 * so its public URL can redirect to the canonical category.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "Loja não encontrada." }, { status: 404 });

  const parsed = Entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });
  const movimentos = parsed.data.movimentos;
  const origens = movimentos.map((m) => m.origemId);
  const destinos = movimentos.map((m) => m.destinoId);
  if (new Set(origens).size !== origens.length || origens.some((id) => destinos.includes(id))) {
    return Response.json({ erro: "Cada categoria de origem deve aparecer uma vez e não pode ser destino no mesmo lote." }, { status: 422 });
  }

  const ids = [...new Set([...origens, ...destinos])];
  const categorias = await prisma.categoria.findMany({ where: { tenantId: tenant.id, id: { in: ids } } });
  const porId = new Map(categorias.map((c) => [c.id, c]));
  if (ids.some((id) => !porId.has(id))) {
    return Response.json({ erro: "Uma ou mais categorias não pertencem a esta loja." }, { status: 422 });
  }
  for (const movimento of movimentos) {
    const origem = porId.get(movimento.origemId)!;
    const destino = porId.get(movimento.destinoId)!;
    if (origem.id === destino.id || slugificar(origem.nome) !== slugificar(destino.nome)) {
      return Response.json({ erro: "Só é permitido consolidar categorias com o mesmo nome." }, { status: 422 });
    }
  }

  const movidos = await prisma.$transaction(async (tx) => {
    const resultados: Array<{ origemId: string; destinoId: string; produtosMovidos: number }> = [];
    for (const movimento of movimentos) {
      const resultado = await tx.produto.updateMany({
        where: { tenantId: tenant.id, categoriaId: movimento.origemId },
        data: { categoriaId: movimento.destinoId },
      });
      resultados.push({ ...movimento, produtosMovidos: resultado.count });
    }
    return resultados;
  });

  return Response.json({ consolidacoes: movidos, categoriasOrigemMantidasVazias: true });
}
