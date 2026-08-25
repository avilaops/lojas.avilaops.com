import { notificacaoValida } from "@/lib/mercadopago-assinatura";
import { processarNotificacao } from "@/lib/assinatura";

/**
 * Webhook da conta Mercado Pago da AVILA OPS (assinaturas das lojas).
 * URL no painel MP: https://lojas.avilaops.com/api/webhooks/mercadopago-assinatura
 * Eventos: subscription_preapproval, subscription_authorized_payment.
 *
 * Responde 200 mesmo quando o processamento falha (o MP reenvia por horas);
 * só assinatura inválida recebe 401.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const corpo = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; action?: string; data?: { id?: string | number }; id?: string | number };
  const topico = corpo.type ?? corpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const dataId = String(corpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? corpo.id ?? "");
  if (!topico || !dataId) return Response.json({ erro: "notificação sem tópico/id" }, { status: 400 });

  const ok = notificacaoValida({ xSignature: request.headers.get("x-signature") ?? "", xRequestId: request.headers.get("x-request-id") ?? "", dataId });
  if (!ok) return Response.json({ erro: "assinatura inválida" }, { status: 401 });

  try {
    const r = await processarNotificacao({ topico, dataId });
    return Response.json({ recebido: true, ...r });
  } catch (erro) {
    console.error("[webhook mp-assinatura]", erro);
    return Response.json({ recebido: true, processada: false });
  }
}
