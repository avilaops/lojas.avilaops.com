import assert from "node:assert/strict";
import test from "node:test";
import { MercadoPagoProvider, criarRotaWebhook } from "@avilaops/checkout/server";
import type { PaymentProvider } from "@avilaops/checkout/server";
import type { PedidoCheckout, ResultadoPagamento } from "@avilaops/checkout";

const resultado: ResultadoPagamento = {
  id: "pagamento-teste", status: "aprovado", meioPagamento: "pix", valor: 1234,
};

test("a cobranca informa o webhook da loja e converte centavos uma vez", async (t) => {
  let enviado: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    enviado = JSON.parse(String(init.body));
    return Response.json({ id: 1, status: "pending", transaction_amount: 12.34, payment_method_id: "pix" });
  });
  const notificationUrl = "https://lojas.example.test/api/webhooks/mercadopago?loja=teste";
  const provider = new MercadoPagoProvider({ accessToken: "token-de-teste", notificationUrl });
  const pedido: PedidoCheckout = {
    referencia: "pedido-teste",
    itens: [{ id: "produto", nome: "Produto", quantidade: 1, precoUnitario: 1234 }],
    cliente: { nome: "Cliente", sobrenome: "Teste", email: "cliente@example.test", telefone: "11999999999", documento: "" },
    frete: { id: "retirada-na-loja", nome: "Retirada", preco: 0, prazoDiasUteis: 0 },
    meioPagamento: "pix",
  };
  await provider.cobrar(pedido, 1234);
  assert.equal(enviado.notification_url, notificationUrl);
  assert.equal(enviado.transaction_amount, 12.34);
});

test("o webhook repassa o valor consultado no gateway para a conciliacao", async () => {
  const provider: PaymentProvider = {
    nome: "teste",
    cobrar: async () => resultado,
    consultar: async () => resultado,
    buscarPorReferencia: async () => null,
    estornar: async () => resultado,
    validarWebhook: async () => ({ pagamentoId: resultado.id }),
  };
  let conciliado: unknown;
  const handler = criarRotaWebhook({
    provider,
    catalogo: { resolverItens: async () => [], resolverFretes: async () => [] },
    aoAtualizarStatus: async (dados) => { conciliado = dados; },
  });
  const response = await handler(new Request("https://lojas.example.test/webhook", {
    method: "POST", body: JSON.stringify({ valorEmCentavos: 1 }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(conciliado, { pagamentoId: resultado.id, status: "aprovado", valorEmCentavos: 1234 });
});
