import { criarRotaWebhook } from "@avilaops/checkout/server";
import { prisma } from "@/lib/db";
import { providerDaLoja } from "@/lib/gateway";
import { atualizarStatusPagamento } from "@/lib/pedidos";

/**
 * Webhook do Mercado Pago. URL cadastrada no painel MP de cada loja:
 *   https://<loja>/api/webhooks/mercadopago?loja=<slug>
 *
 * O `?loja=` existe porque o webhook chega sem cookie e às vezes sem o Host da
 * loja (o MP chama a URL que foi cadastrada, e pode ser a da plataforma).
 * O segredo de assinatura é o da loja, então uma loja não valida webhook de outra.
 */
export async function POST(request: Request) {
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
}
