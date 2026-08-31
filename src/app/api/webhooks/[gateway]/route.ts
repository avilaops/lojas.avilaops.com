import { criarRotaWebhook } from "@avilaops/checkout/server";
import { prisma } from "@/lib/db";
import { providerDaLoja } from "@/lib/gateway";
import { atualizarStatusPagamento } from "@/lib/pedidos";

/**
 * Webhook de pagamento, um endereço por gateway:
 *
 *   /api/webhooks/paypal?loja=<slug>
 *   /api/webhooks/efi?loja=<slug>
 *
 * O Mercado Pago tem rota própria (`/api/webhooks/mercadopago`) porque já
 * estava cadastrada nos painéis e mudar o endereço quebraria loja no ar.
 *
 * Três regras que parecem detalhe e não são:
 *
 * 1. O `?loja=` diz de quem é a notificação. Ela chega sem cookie e muitas
 *    vezes no host da plataforma, não no da loja.
 * 2. A loja só valida a própria notificação: o segredo usado é o dela, então
 *    notificação de uma loja não confirma pedido de outra.
 * 3. O gateway do caminho tem que ser o gateway escolhido pela loja. Sem esta
 *    conferência, quem soubesse a URL poderia escolher o adaptador mais frouxo
 *    para validar a própria mensagem.
 */
const ACEITOS = new Set(["paypal", "efi"]);

type Ctx = { params: Promise<{ gateway: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { gateway } = await params;
  if (!ACEITOS.has(gateway)) return Response.json({ erro: "gateway desconhecido" }, { status: 404 });

  const slug = new URL(request.url).searchParams.get("loja");
  if (!slug) return Response.json({ erro: "loja ausente" }, { status: 400 });

  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  if (t.gateway !== gateway) return Response.json({ erro: "gateway não é o desta loja" }, { status: 409 });

  return criarRotaWebhook({
    provider: providerDaLoja(t),
    catalogo: { resolverItens: async () => [], resolverFretes: async () => [] },
    aoAtualizarStatus: ({ pagamentoId, status }) => atualizarStatusPagamento(t, pagamentoId, status),
  })(request);
}
