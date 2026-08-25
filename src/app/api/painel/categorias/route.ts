import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { slugificar } from "@/lib/catalogo";

const Entrada = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(300).nullable().optional(),
  imagemUrl: z.string().url().nullable().optional(),
  ordem: z.number().int().min(0).max(999).optional(),
});

export async function GET() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  return Response.json(await prisma.categoria.findMany({ where: { tenantId: loja.id }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { produtos: true } } } }));
}

/** POST — cria ou atualiza (com id). */
export async function POST(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });
  const { id, ...dados } = r.data;
  if (id) {
    const c = await prisma.categoria.findFirst({ where: { id, tenantId: loja.id } });
    if (!c) return Response.json({ erro: "Categoria não encontrada." }, { status: 404 });
    return Response.json(await prisma.categoria.update({ where: { id }, data: dados }));
  }
  const slug = slugificar(dados.nome);
  const existente = await prisma.categoria.findUnique({ where: { tenantId_slug: { tenantId: loja.id, slug } } });
  if (existente) return Response.json(await prisma.categoria.update({ where: { id: existente.id }, data: dados }));
  const total = await prisma.categoria.count({ where: { tenantId: loja.id } });
  return Response.json(await prisma.categoria.create({ data: { ...dados, tenantId: loja.id, slug, ordem: dados.ordem ?? total } }));
}

/** DELETE ?id= — apaga; produtos ficam sem categoria. */
export async function DELETE(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const c = await prisma.categoria.findFirst({ where: { id, tenantId: loja.id } });
  if (!c) return Response.json({ erro: "Categoria não encontrada." }, { status: 404 });
  await prisma.categoria.delete({ where: { id } });
  return Response.json({ ok: true });
}
