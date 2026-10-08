import { criarCobranca, lerCorpoDoCheckout } from "@/lib/checkout-cobranca";
import { compradorAtual } from "@/lib/conta";
import { GatewayNaoConfigurado, providerDaLoja } from "@/lib/gateway";
import { medirRota } from "@/lib/metricas-rota";
import { lojaVende, tenantAtual } from "@/lib/tenant";

/**
 * Cobrança pelo checkout da vitrine.
 *
 * Aqui só se escolhe A LOJA da requisição (pelo host), o gateway dela e o
 * comprador logado. O trabalho — validar, montar pelo catálogo, reservar,
 * cobrar e registrar — é de `criarCobranca`, a mesma função da API para
 * desenvolvedores.
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

  const lido = lerCorpoDoCheckout(await request.json().catch(() => null));
  if ("tipo" in lido) return Response.json({ erro: lido.mensagem, codigo: lido.codigo }, { status: lido.status });

  // Comprador logado: o pedido entra no histórico dele e o endereço fica salvo.
  const comprador = await compradorAtual(t);
  const r = await criarCobranca(t, lido.corpo, { provider, compradorId: comprador?.id });

  switch (r.tipo) {
    case "ok":
      return Response.json(r.pagamento);
    case "invalido":
      return Response.json({ erro: r.mensagem, codigo: r.codigo }, { status: r.status });
    case "recusado":
      return Response.json({ erro: "Não foi possível processar o pagamento agora. Nada foi cobrado.", codigo: "falha_gateway" }, { status: 502 });
    case "incerto":
      return Response.json(
        { erro: "Estamos confirmando o pagamento. Consulte o pedido antes de tentar novamente.", codigo: "pagamento_a_confirmar", referencia: r.referencia },
        { status: 503 },
      );
  }
});
