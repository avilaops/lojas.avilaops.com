import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ProdutoEntradaSchema } from "@/lib/admin-schemas";
import { importarProdutos } from "@/lib/admin-tenants";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  return Response.json(await prisma.produto.findMany({ where: { tenantId: t.id }, include: { categoria: true }, orderBy: { nome: "asc" } }));
}

/**
 * PUT — importa/atualiza produtos em lote (a "planilha" do onboarding).
 * Corpo: ProdutoEntrada[]. Idempotente por sku/slug.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const r = z.array(ProdutoEntradaSchema).min(1).max(2000).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });

  return Response.json(await importarProdutos(t.id, r.data));
}
