import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

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

  const pedido = await prisma.pedido.findFirst({ where: { id, tenant: { slug } } });
  if (!pedido) return Response.json({ erro: "pedido não encontrado" }, { status: 404 });
  if (pedido.status === "AGUARDANDO_PAGAMENTO" && r.data.status && r.data.status !== "CANCELADO") {
    return Response.json({ erro: "pedido ainda não foi pago" }, { status: 409 });
  }

  const atualizado = await prisma.pedido.update({ where: { id }, data: { ...(r.data.status ? { status: r.data.status } : {}), ...(r.data.rastreio !== undefined ? { rastreio: r.data.rastreio } : {}) } });
  return Response.json({ id: atualizado.id, status: atualizado.status, rastreio: atualizado.rastreio });
}
