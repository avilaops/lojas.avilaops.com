import { tenantAtual } from "@/lib/tenant";
import { compradorAtual } from "@/lib/conta";
import { consultarRecompra } from "@/lib/recompra-consulta";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ pedidoId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "Loja não encontrada." }, { status: 404, headers });
  const comprador = await compradorAtual(t);
  if (!comprador) return Response.json({ erro: "Entre na sua conta." }, { status: 401, headers });
  const { pedidoId } = await params;
  const revisao = await consultarRecompra(t.id, comprador.id, pedidoId);
  if (!revisao) return Response.json({ erro: "Pedido não encontrado." }, { status: 404, headers });
  if ("erro" in revisao) return Response.json(revisao, { status: 409, headers });
  return Response.json(revisao, { headers });
}
