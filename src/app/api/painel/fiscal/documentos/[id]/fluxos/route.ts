import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { enfileirarFluxosFiscais } from "@/lib/fiscal-fluxos";
import { planoPermite } from "@/lib/api-chaves";

/** Seleção explícita aplica uma regra também a um documento anterior à configuração. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem não permitida." }, { status: 403 });
  if (!planoPermite("SECRETA", s.tenant.plano) || s.tenant.status !== "ATIVA") return Response.json({ erro: "Os fluxos exigem uma loja ativa com plano Loja Pro." }, { status: 403 });
  const r = z.object({ fluxoId: z.string().min(1).max(80) }).strict().safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Selecione um fluxo." }, { status: 422 });
  const { id } = await params;
  const documento = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id } });
  if (!documento) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  const enfileirados = await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, s.tenant.id, [documento], { fluxoId: r.data.fluxoId, solicitadoPor: s.tenant.loginEmail ?? "DONO" }));
  return Response.json({ enfileirados, mensagem: enfileirados ? "Documento encaminhado para revisão no fluxo." : "Nenhum envio novo: confira se o fluxo e o destino estão ativos, se o evento foi selecionado ou se este documento já foi encaminhado." });
}
