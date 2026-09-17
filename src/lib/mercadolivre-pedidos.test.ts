import assert from "node:assert/strict";
import test from "node:test";
import { mapearPedidoMl, meioDePagamentoMl, statusDoPedidoMl, type OrdemMl } from "./mercadolivre-pedidos";
import { lerAviso } from "./mercadolivre-avisos";

/**
 * A venda do Mercado Livre virando pedido da loja. O que está preso aqui é o
 * que não dá para descobrir em produção sem prejuízo: dinheiro em centavos,
 * estoque casado com o produto certo, e o pedido que não pode virar dois.
 */

const casar = (mlb: string) => (mlb === "MLB111" ? { produtoId: "prod-1", sku: "SKU-1" } : undefined);

const ORDEM: OrdemMl = {
  id: 2000003508419013,
  status: "paid",
  total_amount: 129.9,
  order_items: [{ item: { id: "MLB111", title: "Cera de carnaúba 500ml", seller_sku: "SKU-1" }, quantity: 2, unit_price: 64.95 }],
  payments: [{ id: 55, status: "approved", payment_type: "credit_card", shipping_cost: 21.5 }],
  shipping: { id: 41234 },
  buyer: { id: 7, nickname: "COMPRADOR123", first_name: "Ana", last_name: "Souza" },
};

test("reais do Mercado Livre viram centavos inteiros, e o frete entra no total", () => {
  const p = mapearPedidoMl(ORDEM, casar);
  assert.equal(p.itens[0].precoUnitarioCentavos, 6495);
  assert.equal(p.subtotalCentavos, 12990);
  assert.equal(p.freteCentavos, 2150);
  // O `total_amount` do ML não inclui frete; o total da casa inclui.
  assert.equal(p.totalCentavos, 15140);
  assert.deepEqual(p.avisos, []);
});

test("centavos não escorregam no arredondamento do float", () => {
  const p = mapearPedidoMl(
    { ...ORDEM, total_amount: 0.29, order_items: [{ item: { id: "MLB111" }, quantity: 1, unit_price: 0.29 }], payments: [{ shipping_cost: 0.1 }] },
    casar,
  );
  assert.equal(p.itens[0].precoUnitarioCentavos, 29);
  assert.equal(p.freteCentavos, 10);
  assert.equal(p.totalCentavos, 39);
});

test("o item casa com o produto pelo anúncio, e o que não casa avisa em vez de sumir", () => {
  const p = mapearPedidoMl(
    { ...ORDEM, order_items: [...ORDEM.order_items!, { item: { id: "MLB999", title: "Anúncio de outra origem" }, quantity: 1, unit_price: 10 }] },
    casar,
  );
  assert.equal(p.itens.length, 2);
  assert.equal(p.itens[0].produtoId, "prod-1");
  assert.equal(p.itens[1].produtoId, null, "item sem produto entra no pedido, mas sem baixar estoque");
  assert.match(p.avisos.join(" "), /MLB999/);
});

test("a referência e o id de canal saem do pedido do ML, para a ingestão ser idempotente", () => {
  const p = mapearPedidoMl(ORDEM, casar);
  assert.equal(p.canalPedidoId, "2000003508419013");
  assert.equal(p.referencia, "ML-2000003508419013");
});

test("só `paid` baixa estoque; o resto espera", () => {
  assert.equal(statusDoPedidoMl("paid"), "PAGO");
  assert.equal(statusDoPedidoMl("cancelled"), "CANCELADO");
  assert.equal(statusDoPedidoMl("payment_in_process"), "AGUARDANDO_PAGAMENTO");
  assert.equal(statusDoPedidoMl("confirmed"), "AGUARDANDO_PAGAMENTO");
  assert.equal(statusDoPedidoMl(undefined), "AGUARDANDO_PAGAMENTO");
});

test("não se inventa contato do comprador", () => {
  const p = mapearPedidoMl({ ...ORDEM, buyer: { nickname: "COMPRADOR123" } }, casar);
  assert.equal(p.clienteNome, "COMPRADOR123");
  assert.equal(p.clienteEmail, "");
  assert.equal(p.clienteTelefone, "");
  assert.equal(p.clienteDocumento, "");
});

test("forma de pagamento no vocabulário da casa, e o desconhecido vai cru", () => {
  assert.equal(meioDePagamentoMl("credit_card"), "cartao");
  assert.equal(meioDePagamentoMl("ticket"), "boleto");
  assert.equal(meioDePagamentoMl("pix"), "pix");
  assert.equal(meioDePagamentoMl("account_money"), "saldo-ml");
  assert.equal(meioDePagamentoMl("consumer_credits"), "consumer_credits");
});

test("linha sem anúncio ou sem quantidade não vira item mudo", () => {
  const p = mapearPedidoMl({ ...ORDEM, order_items: [{ item: {}, quantity: 1 }, { item: { id: "MLB111" }, quantity: 0 }] }, casar);
  assert.equal(p.itens.length, 0);
  // Duas linhas descartadas, e — em consequência — o total do ML deixa de bater
  // com a soma dos itens. O terceiro aviso é o que impede o pedido de ser
  // faturado como se fosse de R$ 0,00 sem ninguém olhar.
  assert.equal(p.avisos.filter((a) => a.includes("ficou de fora do pedido")).length, 2);
  assert.match(p.avisos.join(" "), /não bate com o total/);
});

test("cancelamento carrega o motivo do Mercado Livre", () => {
  const p = mapearPedidoMl({ ...ORDEM, status: "cancelled", cancel_detail: { description: "Arrependimento do comprador" } }, casar);
  assert.equal(p.status, "CANCELADO");
  assert.match(p.avisos.join(" "), /Arrependimento/);
});

test("o aviso do ML diz qual recurso buscar, nas duas formas que chegam", () => {
  assert.deepEqual(lerAviso("mercadolivre.orders_v2", { topic: "orders_v2", resource: "/orders/2000003508419013" }), {
    topico: "orders_v2",
    id: "2000003508419013",
  });
  // Envelope antigo, sem `topic`: o tipo do evento ainda diz o tópico.
  assert.deepEqual(lerAviso("mercadolivre.items", { resource: "/items/MLB111" }), { topico: "items", id: "MLB111" });
  assert.equal(lerAviso("mercadolivre.orders_v2", {}), null, "sem recurso não há o que buscar");
  assert.equal(lerAviso("mercadolivre.orders_v2", null), null);
});
