import { criarRotaPagamento, type ResolucaoCatalogo } from "@avilaops/checkout/server";
import { lojaVende, tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";
import { GatewayNaoConfigurado, providerDaLoja } from "@/lib/gateway";
import { registrarPedido } from "@/lib/pedidos";

/**
 * Cobrança. O @avilaops/checkout faz o trabalho pesado (recalcular o total
 * pelo catálogo, cobrar no gateway); aqui só se escolhe A LOJA da requisição
 * — o handler do pacote é criado por requisição porque provider e catálogo
 * são do tenant, não da instância.
 */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  if (!lojaVende(t)) return Response.json({ erro: "Esta loja não está recebendo pedidos no momento." }, { status: 403 });

  let provider;
  try {
    provider = providerDaLoja(t);
  } catch (erro) {
    if (erro instanceof GatewayNaoConfigurado) return Response.json({ erro: "Pagamento online ainda não configurado. Fale com a loja pelo WhatsApp." }, { status: 503 });
    throw erro;
  }

  const catalogo: ResolucaoCatalogo = {
    resolverItens: (ids) => resolverItensDoCatalogo(t.id, ids),
    resolverFretes: ({ itens, cep }) => cotarFrete(t, cep, itens),
  };

  // O payload já foi lido pelo pacote; para persistir o pedido com os dados do
  // cliente precisamos dele também — clonamos a requisição antes.
  const copia = request.clone();
  const handler = criarRotaPagamento({
    provider,
    catalogo,
    aoCriarPagamento: async ({ referencia, pagamentoId, status, total }) => {
      const payload = await copia.json();
      await registrarPedido(t, { referencia, pagamentoId, status, total, payload, catalogo });
    },
  });
  return handler(request);
}
