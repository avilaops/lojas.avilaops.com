import { prisma } from "@/lib/db";
import { assinaturaMelhorEnvioValida, STATUS_MELHOR_ENVIO } from "@/lib/melhor-envio-webhook";
import { avisarEnvio } from "@/lib/postagem";

/** Recebe apenas eventos assinados do aplicativo Melhor Envio da plataforma. */
export async function POST(request: Request) {
  const corpo = await request.text();
  if (!assinaturaMelhorEnvioValida(corpo, request.headers.get("x-me-signature"))) return Response.json({ erro: "Assinatura inválida." }, { status: 401 });
  const bruto = await (async () => { try { return JSON.parse(corpo) as unknown; } catch { return null; } })();
  if (!bruto || typeof bruto !== "object") return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  const evento = bruto as { event?: unknown; data?: unknown };
  if (typeof evento.event !== "string" || !evento.event.startsWith("order.")) return Response.json({ erro: "Evento inválido." }, { status: 400 });
  const dado = evento.data && typeof evento.data === "object" ? evento.data as Record<string, unknown> : {};
  const id = typeof dado.id === "string" ? dado.id : null;
  const status = typeof dado.status === "string" ? dado.status : evento.event.replace(/^order\./, "");
  if (!id || !status || !STATUS_MELHOR_ENVIO.has(status)) return Response.json({ erro: "Postagem inválida." }, { status: 400 });

  const postagem = await prisma.postagem.findFirst({ where: { provedor: "melhorenvio", provedorId: id }, include: { pedido: true, tenant: true } });
  if (!postagem) return Response.json({ ok: true, ignorado: true });
  const tracking = typeof dado.tracking === "string" && dado.tracking.trim() ? dado.tracking.trim() : null;
  const trackingUrl = typeof dado.tracking_url === "string" && dado.tracking_url.trim() ? dado.tracking_url.trim() : null;
  const statusPedido = status === "delivered" ? "ENTREGUE" : status === "posted" ? "ENVIADO" : ["generated", "released", "received"].includes(status) && postagem.pedido.status === "PAGO" ? "EM_SEPARACAO" : undefined;
  const notificouRastreio = await prisma.$transaction(async (tx) => {
    await tx.postagem.update({ where: { id: postagem.id }, data: { provedorStatus: status, codigoObjeto: tracking ?? postagem.codigoObjeto, rastreioUrl: trackingUrl ?? postagem.rastreioUrl, status: status === "cancelled" ? "cancelada" : postagem.status === "carrinho" && status !== "created" ? "comprada" : postagem.status } });
    if (!tracking && !statusPedido) return false;
    const atualizado = tracking
      ? await tx.pedido.updateMany({ where: { id: postagem.pedido.id, rastreio: null }, data: { rastreio: tracking, ...(statusPedido ? { status: statusPedido } : {}) } })
      : { count: 0 };
    if (tracking && statusPedido && atualizado.count === 0) {
      await tx.pedido.update({ where: { id: postagem.pedido.id }, data: { status: statusPedido } });
    }
    if (!tracking && statusPedido) await tx.pedido.update({ where: { id: postagem.pedido.id }, data: { status: statusPedido } });
    return Boolean(tracking && atualizado.count === 1);
  });
  if (notificouRastreio && tracking) await avisarEnvio(postagem.tenant, postagem.pedido, tracking);
  return Response.json({ ok: true });
}
