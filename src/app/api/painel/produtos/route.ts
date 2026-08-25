import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProdutoEntradaSchema } from "@/lib/admin-schemas";
import { importarProdutos } from "@/lib/admin-tenants";
import { lojistaAtual } from "@/lib/sessao";

/** PUT — importa/atualiza em lote (CSV ou um único produto do formulário). */
export async function PUT(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const r = z.array(ProdutoEntradaSchema).min(1).max(2000).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  return Response.json(await importarProdutos(loja.id, r.data));
}

/** DELETE ?id= — desativa (não apaga: pedidos antigos apontam para ele). */
export async function DELETE(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const p = await prisma.produto.findFirst({ where: { id, tenantId: loja.id } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  await prisma.produto.update({ where: { id }, data: { ativo: false } });
  return Response.json({ ok: true });
}
