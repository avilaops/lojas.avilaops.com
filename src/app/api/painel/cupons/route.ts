import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { normalizarCodigo } from "@/lib/cupons";

const Entrada = z.object({
  codigo: z.string().trim().min(2).max(40),
  tipo: z.enum(["PERCENTUAL", "FIXO", "FRETE_GRATIS"]),
  valor: z.number().int().nonnegative().default(0),
  minimoCentavos: z.number().int().nonnegative().default(0),
  usosMax: z.number().int().positive().nullable().optional(),
  validoAte: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  return Response.json(await prisma.cupom.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" } }));
}

/** POST — cria ou atualiza pelo código. */
export async function POST(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  if (r.data.tipo === "PERCENTUAL" && (r.data.valor < 1 || r.data.valor > 100)) return Response.json({ erro: "Percentual entre 1 e 100." }, { status: 422 });
  if (r.data.tipo === "FIXO" && r.data.valor < 1) return Response.json({ erro: "Informe o valor do desconto." }, { status: 422 });

  const codigo = normalizarCodigo(r.data.codigo);
  const dados = { tipo: r.data.tipo, valor: r.data.valor, minimoCentavos: r.data.minimoCentavos, usosMax: r.data.usosMax ?? null, validoAte: r.data.validoAte ? new Date(r.data.validoAte) : null, ativo: true };
  const c = await prisma.cupom.upsert({ where: { tenantId_codigo: { tenantId: loja.id, codigo } }, update: dados, create: { ...dados, tenantId: loja.id, codigo } });
  return Response.json(c);
}

/** DELETE ?codigo= — desativa. */
export async function DELETE(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const codigo = normalizarCodigo(new URL(request.url).searchParams.get("codigo") ?? "");
  await prisma.cupom.updateMany({ where: { tenantId: loja.id, codigo }, data: { ativo: false } });
  return Response.json({ ok: true });
}
