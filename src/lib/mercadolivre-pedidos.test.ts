import assert from "node:assert/strict";
import test from "node:test";
import { mapearPedidoMl, meioDePagamentoMl, resolverVariante, statusDoPedidoMl, type OrdemMl, type ProdutoCasado } from "./mercadolivre-pedidos";
import { lerAviso } from "./mercadolivre-avisos";

/**
 * A venda do Mercado Livre virando pedido da loja. O que está preso aqui é o
 * que não dá para descobrir em produção sem prejuízo: dinheiro em centavos,
 * estoque casado com o produto certo, e o pedido que não pode virar dois.
 */

const casar = (mlb: string) =>
  mlb === "MLB111"
    ? { produtoId: "prod-1", sku: "SKU-1", variantes: [{ id: "v-unica", nome: "Padrão", sku: "SKU-1", padrao: true, valores: {} }] }
    : undefined;

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

test("o id de canal sai do pedido do ML, para a ingestão ser idempotente", () => {
  const p = mapearPedidoMl(ORDEM, casar);
  assert.equal(p.canalPedidoId, "2000003508419013");
});

test("o mapeamento não carrega referência: ela é segredo e não se deriva do id do ML", () => {
  // `/pedido/[referencia]` é público e mostra nome, e-mail, itens e rastreio.
  // Uma referência derivada do número da ordem do ML — que o comprador vê e
  // que se enumera — devolveria o furo que a plataforma acabou de fechar.
  const p = mapearPedidoMl(ORDEM, casar) as unknown as Record<string, unknown>;
  assert.equal("referencia" in p, false);
  assert.equal(JSON.stringify(p).includes("ML-2000003508419013"), false);
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

/**
 * Qual apresentação o Mercado Livre vendeu.
 *
 * Até 19/09/2026 o pedido nascia sem variante e o estoque saía da **padrão**,
 * seja qual fosse a vendida. Numa loja de camiseta, vender o G tirava o P: o P
 * some da prateleira enquanto está lá, o G continua à venda depois de acabar, e
 * a segunda venda do G vira cancelamento — que no ML custa reputação.
 */
const CAMISETA: ProdutoCasado = {
  produtoId: "prod-camiseta",
  sku: "CAM",
  variantes: [
    { id: "v-p", nome: "P / Azul", sku: "CAM-P-AZ", padrao: true, valores: { Tamanho: "P", Cor: "Azul" } },
    { id: "v-g", nome: "G / Azul", sku: "CAM-G-AZ", padrao: false, valores: { Tamanho: "G", Cor: "Azul" } },
    { id: "v-g-vm", nome: "G / Vermelho", sku: null, valores: { Tamanho: "G", Cor: "Vermelho" }, padrao: false },
  ],
};

test("o SKU da variação decide, e não a apresentação padrão", () => {
  const r = resolverVariante({ seller_sku: "CAM-G-AZ" }, CAMISETA);
  assert.equal(r.varianteId, "v-g");
  assert.equal(r.por, "sku");
});

test("sem SKU, os atributos escolhidos pelo comprador decidem", () => {
  const r = resolverVariante(
    { variation_attributes: [{ name: "Tamanho", value_name: "G" }, { name: "Cor", value_name: "Vermelho" }] },
    CAMISETA,
  );
  assert.equal(r.varianteId, "v-g-vm");
  assert.equal(r.por, "atributos");
});

test("acento e caixa não atrapalham o casamento por atributo", () => {
  const produto: ProdutoCasado = {
    produtoId: "p", sku: null,
    variantes: [
      { id: "a", nome: "Único", sku: null, padrao: true, valores: { "Tamanho padrão": "Único" } },
      { id: "b", nome: "Grande", sku: null, padrao: false, valores: { "Tamanho padrão": "Grande" } },
    ],
  };
  const r = resolverVariante({ variation_attributes: [{ name: "TAMANHO PADRAO", value_name: "unico" }] }, produto);
  assert.equal(r.varianteId, "a");
});

test("atributo que casa com duas variantes é ambiguidade, não resposta", () => {
  // "Tamanho G" sozinho serve para G/Azul e G/Vermelho. Escolher uma seria
  // chutar — e chutar aqui estraga duas apresentações de uma vez.
  const r = resolverVariante({ variation_attributes: [{ name: "Tamanho", value_name: "G" }] }, CAMISETA);
  assert.equal(r.varianteId, null);
  assert.equal(r.por, "nao-identificada");
});

test("produto de uma apresentação só não tem o que escolher", () => {
  const r = resolverVariante({}, { produtoId: "p", sku: "S", variantes: [{ id: "v", nome: "Padrão", sku: "S", padrao: true, valores: {} }] });
  assert.equal(r.varianteId, "v");
  assert.equal(r.por, "unica");
});

test("variação irreconhecível não vira a padrão", () => {
  const r = resolverVariante({ seller_sku: "SKU-QUE-NAO-EXISTE" }, CAMISETA);
  assert.equal(r.varianteId, null, "chutar a padrão é exatamente o bug que isto corrige");
  assert.equal(r.por, "nao-identificada");
});

test("anúncio sem produto casado não resolve variante nenhuma", () => {
  const r = resolverVariante({ seller_sku: "X" }, undefined);
  assert.equal(r.varianteId, null);
  assert.equal(r.por, "sem-produto");
});

test("o pedido do ML carrega a variante vendida, e avisa quando não a reconhece", () => {
  const comVariacao: OrdemMl = {
    ...ORDEM,
    order_items: [
      { item: { id: "MLB222", title: "Camiseta", seller_sku: "CAM-G-AZ", variation_id: 99 }, quantity: 1, unit_price: 50 },
    ],
    total_amount: 50,
  };
  const casarCamiseta = (mlb: string) => (mlb === "MLB222" ? CAMISETA : undefined);

  const certo = mapearPedidoMl(comVariacao, casarCamiseta);
  assert.equal(certo.itens[0].varianteId, "v-g");
  assert.equal(certo.itens[0].varianteNome, "G / Azul");
  assert.deepEqual(certo.avisos, []);

  const perdido = mapearPedidoMl(
    { ...comVariacao, order_items: [{ item: { id: "MLB222", title: "Camiseta", seller_sku: "NAO-EXISTE", variation_id: 99 }, quantity: 1, unit_price: 50 }] },
    casarCamiseta,
  );
  assert.equal(perdido.itens[0].varianteId, null);
  // O aviso precisa ensinar o que fazer, não só constatar.
  assert.match(perdido.avisos[0] ?? "", /estoque NÃO foi baixado/);
  assert.match(perdido.avisos[0] ?? "", /SKU da variação/);
});
