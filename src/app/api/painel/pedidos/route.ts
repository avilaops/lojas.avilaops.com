import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";

const Entrada = z.object({
  id: z.string(),
  status: z.enum(["EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"]).optional(),
  rastreio: z.string().trim().max(60).nullable().optional(),
});

/** PATCH — o lojista avança o pedido. Pagamento só muda pelo webhook. */
export async function PATCH(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });

  const pedido = await prisma.pedido.findFirst({ where: { id: r.data.id, tenantId: loja.id } });
  if (!pedido) return Response.json({ erro: "Pedido não encontrado." }, { status: 404 });
  if (pedido.status === "AGUARDANDO_PAGAMENTO" && r.data.status && r.data.status !== "CANCELADO") {
    return Response.json({ erro: "Pedido ainda não foi pago." }, { status: 409 });
  }
  const a = await prisma.pedido.update({
    where: { id: pedido.id },
    data: { ...(r.data.status ? { status: r.data.status } : {}), ...(r.data.rastreio !== undefined ? { rastreio: r.data.rastreio } : {}) },
  });
  return Response.json({ id: a.id, status: a.status, rastreio: a.rastreio });
}
