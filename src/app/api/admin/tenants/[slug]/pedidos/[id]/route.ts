import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { mudarStatusDoPedido, MudancaDeStatusRecusada } from "@/lib/pedidos-status";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const Entrada = z.object({
  status: z.enum(["EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"]).optional(),
  rastreio: z.string().trim().max(60).nullable().optional(),
});

/**
 * PATCH — o lojista avança o pedido (separando → enviado com rastreio → entregue).
 * Estados de pagamento (PAGO/ESTORNADO) só mudam pelo webhook do gateway.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, id } = await params;

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });

  const loja = await prisma.tenant.findUnique({ where: { slug } });
  if (!loja) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  try {
    const { pedido } = await mudarStatusDoPedido(loja, id, { ...r.data, ator: { tipo: "SISTEMA" }, origem: "admin", idempotencia: request.headers.get("idempotency-key")?.trim() || undefined });
    return Response.json({ id: pedido.id, status: pedido.status, rastreio: pedido.rastreio });
  } catch (erro) {
    if (!(erro instanceof MudancaDeStatusRecusada)) throw erro;
    return Response.json({ erro: erro.message }, { status: erro.motivo === "nao_encontrado" ? 404 : 409 });
  }
}
