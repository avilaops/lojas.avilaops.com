import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";

/** PATCH { id, aprovada } — aprova/oculta. DELETE ?id= — apaga. */
export async function PATCH(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const r = z.object({ id: z.string(), aprovada: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });
  const a = await prisma.avaliacao.findFirst({ where: { id: r.data.id, tenantId: loja.id } });
  if (!a) return Response.json({ erro: "Avaliação não encontrada." }, { status: 404 });
  await prisma.avaliacao.update({ where: { id: a.id }, data: { aprovada: r.data.aprovada } });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await prisma.avaliacao.deleteMany({ where: { id, tenantId: loja.id } });
  return Response.json({ ok: true });
}
