import { z } from "zod";
import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";
import { compradorAtual } from "@/lib/conta";

const Entrada = z.object({
  id: z.string().optional(),
  apelido: z.string().trim().max(40).optional(),
  cep: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().length(8)),
  logradouro: z.string().trim().min(2).max(120),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(60).optional(),
  bairro: z.string().trim().min(1).max(80),
  cidade: z.string().trim().min(1).max(80),
  uf: z.string().trim().length(2),
  principal: z.boolean().optional(),
});

/** POST — cria ou atualiza um endereço salvo do comprador. */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const c = await compradorAtual(t);
  if (!c) return Response.json({ erro: "Entre na sua conta." }, { status: 401 });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Endereço incompleto." }, { status: 422 });
  const { id, principal, ...dados } = r.data;

  const salvo = id
    ? await prisma.enderecoComprador.update({ where: { id }, data: { ...dados, uf: dados.uf.toUpperCase() } })
    : await prisma.enderecoComprador.create({ data: { ...dados, uf: dados.uf.toUpperCase(), compradorId: c.id } });

  // Só um endereço principal por comprador.
  if (principal) {
    await prisma.enderecoComprador.updateMany({ where: { compradorId: c.id, id: { not: salvo.id } }, data: { principal: false } });
    await prisma.enderecoComprador.update({ where: { id: salvo.id }, data: { principal: true } });
  }
  return Response.json({ ok: true, id: salvo.id });
}

export async function DELETE(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const c = await compradorAtual(t);
  if (!c) return Response.json({ erro: "Entre na sua conta." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await prisma.enderecoComprador.deleteMany({ where: { id, compradorId: c.id } });
  return Response.json({ ok: true });
}
