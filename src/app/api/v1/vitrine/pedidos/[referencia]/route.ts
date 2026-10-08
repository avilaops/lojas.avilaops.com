import { prisma } from "@/lib/db";
import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { pedidoDaVitrine } from "@/lib/api-recursos";
import { ErroApi } from "@/lib/api-resposta";
import { urlDaLoja } from "@/lib/tenant";

/**
 * GET /api/v1/vitrine/pedidos/{referencia} — o andamento do pedido, para a tela
 * do Pix saber que foi pago e para a página "meu pedido" do front próprio.
 *
 * A referência é o segredo (128 bits, sorteada na compra): quem a tem é quem
 * comprou. Lê o pedido do banco, não o gateway — o que a loja considera pago é
 * o que o webhook confirmou e baixou do estoque. Não devolve dado pessoal.
 */
export const dynamic = "force-dynamic";

export const GET = rotaDaApi<{ referencia: string }>({ escopo: "vitrine:comprar", navegador: true }, async ({ tenant, params }) => {
  const pedido = await prisma.pedido.findFirst({ where: { tenantId: tenant.id, referencia: params.referencia }, include: { itens: true } });
  if (!pedido) throw new ErroApi("nao_encontrado", "Pedido não encontrado nesta loja.");
  return { dados: pedidoDaVitrine(pedido, urlDaLoja(tenant)) };
});

export const OPTIONS = preVooDaVitrine;
