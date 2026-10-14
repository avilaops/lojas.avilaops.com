import { criarRotaWebhook } from "@avilaops/checkout/server";
import { prisma } from "@/lib/db";
import { providerDaCredencial } from "@/lib/credenciais";
import { GatewayNaoConfigurado } from "@/lib/gateway";
import { medirRota } from "@/lib/metricas-rota";
import { processarNotificacao } from "@/lib/webhook-pagamentos";

export const dynamic = "force-dynamic";

/**
 * Webhook genérico: POST /api/webhooks/pagamentos/{provedor}/{token}.
 *
 * O token (aleatório, por credencial) acha a loja e a credencial sem expor o
 * slug. Depois, o de sempre: o adaptador valida a assinatura do provedor, o
 * pagamento é RECONSULTADO na API com a credencial desta loja (o corpo do aviso
 * nunca é a fonte do status) e a mudança passa pela trava de idempotência.
 *
 * `/api/webhooks/mercadopago?loja=` segue no ar para o Mercado Pago legado.
 */
export const POST = medirRota("webhook", async function (request: Request, ctx: { params: Promise<{ provedor: string; token: string }> }) {
  const { provedor, token } = await ctx.params;
  if (!/^[0-9a-f]{48}$/.test(token)) return Response.json({ erro: "não encontrado" }, { status: 404 });
  const c = await prisma.credencialPagamento.findUnique({ where: { webhookToken: token }, include: { tenant: true } });
  if (!c || c.provedor !== provedor) return Response.json({ erro: "não encontrado" }, { status: 404 });

  let provider;
  try {
    provider = providerDaCredencial(c.tenant, c);
  } catch (erro) {
    if (erro instanceof GatewayNaoConfigurado) return Response.json({ erro: "credencial indisponível" }, { status: 410 });
    throw erro;
  }

  return criarRotaWebhook({
    provider,
    catalogo: { resolverItens: async () => [], resolverFretes: async () => [] },
    aoAtualizarStatus: async ({ pagamentoId, status, valorEmCentavos }) => {
      await processarNotificacao(c.tenant, c, { pagamentoId, status, valorEmCentavos });
    },
  })(request);
});
