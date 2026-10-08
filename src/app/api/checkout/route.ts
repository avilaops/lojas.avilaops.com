import { montarPedidoSeguro, PedidoInvalidoError, type ResolucaoCatalogo, type PayloadCheckout } from "@avilaops/checkout/server";
import { reservarEstoque, liberarReservas } from "@/lib/catalogo-reservas";
import { ErroCatalogo } from "@/lib/catalogo-oferta";
import { prisma } from "@/lib/db";
import { lojaVende, tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";
import { buscarCupomValido, descontoDoCupom, normalizarCodigo } from "@/lib/cupons";
import { GatewayNaoConfigurado, providerDaLoja } from "@/lib/gateway";
import { registrarPedido } from "@/lib/pedidos";
import { compradorAtual } from "@/lib/conta";
import { medirRota } from "@/lib/metricas-rota";

/**
 * Cobrança. O @avilaops/checkout faz o trabalho pesado (recalcular o total
 * pelo catálogo, cobrar no gateway); aqui só se escolhe A LOJA da requisição
 * — o handler do pacote é criado por requisição porque provider, catálogo e
 * cupom são do pedido, não da instância.
 */
export const POST = medirRota("checkout", async function (request: Request) {
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

  // Lemos o corpo uma vez (cupom + persistência); o pacote recebe uma cópia.
  const copia = request.clone();
  const payload = (await request.json().catch(() => ({}))) as { cupom?: string };
  const codigoCupom = payload.cupom ? normalizarCodigo(String(payload.cupom)) : null;

  // O cupom é resolvido uma vez por requisição: frete grátis e desconto lêem o mesmo.
  let cupomResolvido: Awaited<ReturnType<typeof buscarCupomValido>> | null = null;
  async function cupom(itens: Parameters<typeof descontoDoCupom>[1]) {
    if (!codigoCupom) return null;
    if (!cupomResolvido) {
      const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
      cupomResolvido = await buscarCupomValido(t!.id, codigoCupom, subtotal);
    }
    return "cupom" in cupomResolvido ? cupomResolvido.cupom : null;
  }

  const catalogo: ResolucaoCatalogo = {
    resolverItens: (ids) => resolverItensDoCatalogo(t.id, ids),
    // Pedido mínimo é dado da loja; quem recusa é o montarPedidoSeguro.
    pedidoMinimo: t.pedidoMinimoCentavos,
    resolverFretes: async ({ itens, cep }) => cotarFrete(t, cep, itens, { freteGratisCupom: (await cupom(itens))?.tipo === "FRETE_GRATIS" }),
    resolverDesconto: async ({ itens }) => {
      const c = await cupom(itens);
      return c ? descontoDoCupom(c, itens) : 0;
    },
  };

  // Comprador logado: o pedido entra no histórico dele e o endereço fica salvo.
  const comprador = await compradorAtual(t);

  let reservou = false;
  let referencia = "";
  let iniciouCobranca = false;
  try {
    const corpo = await copia.json() as PayloadCheckout;
    const { pedido, total } = await montarPedidoSeguro(corpo, catalogo);
    referencia = pedido.referencia;
    await reservarEstoque(t.id, referencia, pedido.itens);
    reservou = true;
    iniciouCobranca = true;
    const resultado = await provider.cobrar(pedido, total);
    await prisma.tentativaCatalogo.update({ where: { tenantId_referencia: { tenantId:t.id,referencia } }, data:{estado:"COBRANCA_CRIADA",pagamentoId:resultado.id} });
    const c = await cupom([]);
    await registrarPedido(t, { referencia, pagamentoId:resultado.id, status:resultado.status, total, payload:corpo, catalogo, pedidoResolvido:pedido, cupomCodigo:c?.codigo, compradorId:comprador?.id });
    return Response.json(resultado);
  } catch(e) {
    if(reservou && !iniciouCobranca) await liberarReservas(t.id,referencia);
    if(iniciouCobranca) {
      // Timeout pode significar cobrança criada. Não liberar estoque nem prometer ausência de cobrança.
      await prisma.tentativaCatalogo.updateMany({where:{tenantId:t.id,referencia,estado:{not:"CONFIRMADA"}},data:{estado:"INCERTA"}});
      console.error("[checkout] cobrança a reconciliar",referencia,e);
      return Response.json({erro:"Estamos confirmando o pagamento. Consulte o pedido antes de tentar novamente.",codigo:"pagamento_a_confirmar",referencia},{status:503});
    }
    if(e instanceof ErroCatalogo) return Response.json({erro:e.message},{status:e.status});
    if(e instanceof PedidoInvalidoError) return Response.json({erro:e.message,codigo:e.codigo},{status:422});
    throw e;
  }
});
