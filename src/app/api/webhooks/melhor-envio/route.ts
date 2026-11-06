import { prisma } from "@/lib/db";
import { assinaturaMelhorEnvioValida, alvoPedidoMelhorEnvio, statusPostagemMelhorEnvio, STATUS_MELHOR_ENVIO, transicoesPedidoMelhorEnvio } from "@/lib/melhor-envio-webhook";
import { mudarStatusDoPedido } from "@/lib/pedidos-status";
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
  const statusPostagem = statusPostagemMelhorEnvio(postagem.status, status);
  await prisma.postagem.update({
    where: { id: postagem.id },
    data: {
      provedorStatus: status,
      codigoObjeto: tracking ?? postagem.codigoObjeto,
      rastreioUrl: trackingUrl ?? postagem.rastreioUrl,
      status: statusPostagem,
    },
  });

  const alvoPedido = alvoPedidoMelhorEnvio(postagem.pedido.status, status);
  const transicoes = alvoPedido ? transicoesPedidoMelhorEnvio(postagem.pedido.status, alvoPedido) : [];
  const chaveEvento = `melhor-envio:${id}:${evento.event}:${status}:${tracking ?? ""}`;
  for (const novoStatus of transicoes) {
    await mudarStatusDoPedido(postagem.tenant, postagem.pedido.id, {
      status: novoStatus,
      rastreio: tracking && ["ENVIADO", "ENTREGUE"].includes(novoStatus) ? tracking : undefined,
      ator: { tipo: "CANAL" },
      origem: "webhook:melhor-envio",
      idempotencia: `${chaveEvento}:${novoStatus}`,
    });
  }

  if (!transicoes.length && tracking && tracking !== postagem.pedido.rastreio) {
    await mudarStatusDoPedido(postagem.tenant, postagem.pedido.id, {
      rastreio: tracking,
      ator: { tipo: "CANAL" },
      origem: "webhook:melhor-envio",
      idempotencia: `${chaveEvento}:rastreio`,
    });
    await avisarEnvio(postagem.tenant, postagem.pedido, tracking);
  }
  return Response.json({ ok: true });
}
