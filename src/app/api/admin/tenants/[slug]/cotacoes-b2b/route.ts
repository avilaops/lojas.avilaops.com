import { criarCotacaoB2B, expirarCotacoesVencidas } from "@/lib/cotacoes-b2b";
import { contextoCotacao, erroCotacao } from "@/lib/cotacoes-b2b-api";
import { CriarCotacaoSchema } from "@/lib/cotacoes-b2b-schema";
import { prisma } from "@/lib/db";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { slug } = await params; const contexto = await contextoCotacao(request, slug); if ("resposta" in contexto) return contexto.resposta;
  await expirarCotacoesVencidas(contexto.tenant.id);
  return Response.json({ cotacoes: await prisma.cotacaoB2B.findMany({ where: { tenantId: contexto.tenant.id }, include: { empresa: { select: { razaoSocial: true } }, versoes: { orderBy: { numero: "desc" }, take: 1 } }, orderBy: { criadoEm: "desc" } }) });
}
export async function POST(request: Request, { params }: Ctx) {
  const { slug } = await params; const contexto = await contextoCotacao(request, slug); if ("resposta" in contexto) return contexto.resposta;
  const lida = CriarCotacaoSchema.safeParse(await request.json().catch(() => null));
  if (!lida.success) return Response.json({ erro: "dados inválidos", detalhes: lida.error.flatten() }, { status: 422 });
  const { ator, ...entrada } = lida.data;
  try { return Response.json(await criarCotacaoB2B(contexto.tenant.id, entrada, ator), { status: 201 }); } catch (erro) { return erroCotacao(erro); }
}
