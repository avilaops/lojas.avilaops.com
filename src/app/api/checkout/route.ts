import { criarRotaPagamento, type ResolucaoCatalogo } from "@avilaops/checkout/server";
import { lojaVende, tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";
import { buscarCupomValido, descontoDoCupom, normalizarCodigo } from "@/lib/cupons";
import { GatewayNaoConfigurado, providerDaLoja } from "@/lib/gateway";
import { registrarPedido } from "@/lib/pedidos";
import { compradorAtual } from "@/lib/conta";

/**
 * Cobrança. O @avilaops/checkout faz o trabalho pesado (recalcular o total
 * pelo catálogo, cobrar no gateway); aqui só se escolhe A LOJA da requisição
 * — o handler do pacote é criado por requisição porque provider, catálogo e
 * cupom são do pedido, não da instância.
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
    resolverFretes: async ({ itens, cep }) => cotarFrete(t, cep, itens, { freteGratisCupom: (await cupom(itens))?.tipo === "FRETE_GRATIS" }),
    resolverDesconto: async ({ itens }) => {
      const c = await cupom(itens);
      return c ? descontoDoCupom(c, itens) : 0;
    },
  };

  // Comprador logado: o pedido entra no histórico dele e o endereço fica salvo.
  const comprador = await compradorAtual(t);

  const handler = criarRotaPagamento({
    provider,
    catalogo,
    aoCriarPagamento: async ({ referencia, pagamentoId, status, total }) => {
      const corpo = await copia.clone().json();
      const c = await cupom([]);
      await registrarPedido(t, { referencia, pagamentoId, status, total, payload: corpo, catalogo, cupomCodigo: c ? c.codigo : null, compradorId: comprador?.id ?? null });
    },
  });
  return handler(copia);
}
