import { criarRotaWebhook } from "@avilaops/checkout/server";
import { prisma } from "@/lib/db";
import { providerDaLoja } from "@/lib/gateway";
import { atualizarStatusPagamento } from "@/lib/pedidos";
import { hostDoWebhook, medirRota } from "@/lib/metricas-rota";

/**
 * Webhook do Mercado Pago. URL cadastrada no painel MP de cada loja:
 *   https://<loja>/api/webhooks/mercadopago?loja=<slug>
 *
 * O `?loja=` existe porque o webhook chega sem cookie e às vezes sem o Host da
 * loja (o MP chama a URL que foi cadastrada, e pode ser a da plataforma).
 * Loja que cola as próprias chaves valida com o segredo dela. Loja conectada
 * por OAuth valida com o segredo do aplicativo da plataforma, igual para todas:
 * ali o que impede o aviso de uma loja de mexer no pedido de outra é a consulta
 * do pagamento, feita com o token da loja do `?loja=`, que não enxerga o
 * pagamento de outra conta.
 *
 * Pelo mesmo motivo a métrica vai para `<slug>.<LOJAS_BASE_DOMAIN>`, e não para
 * o host da requisição: só o slug é lido da query.
 */
export const POST = medirRota("webhook", async function (request: Request) {
  const slug = new URL(request.url).searchParams.get("loja");
  if (!slug) return Response.json({ erro: "loja ausente" }, { status: 400 });
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  return criarRotaWebhook({
    provider: providerDaLoja(t),
    catalogo: { resolverItens: async () => [], resolverFretes: async () => [] },
    aoAtualizarStatus: ({ pagamentoId, status, valorEmCentavos }) =>
      atualizarStatusPagamento(t, pagamentoId, status, valorEmCentavos),
  })(request);
}, { host: hostDoWebhook });
