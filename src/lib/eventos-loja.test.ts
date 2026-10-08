import assert from "node:assert/strict";
import test from "node:test";
import { cargaGtm } from "./eventos-loja";

/**
 * Loja com só o GTM colado (PK Vedações, 07/10/2026): os eventos saíam por
 * `gtag('event')`, que o Tag Manager não lê como gatilho. O que a tag do GA4
 * dentro do container entende é `{ event, ecommerce }`.
 */
test("o evento sai no formato que o Tag Manager lê, em reais", () => {
  const carga = cargaGtm("purchase", [{ id: "p1", nome: "Gaxeta", precoCentavos: 1990, quantidade: 2, categoria: "Gaxetas" }], { valor: 4980, transacao: "PK-1", frete: 1000 });
  assert.deepEqual(carga, {
    event: "purchase",
    ecommerce: {
      currency: "BRL",
      value: 49.8,
      items: [{ item_id: "p1", item_name: "Gaxeta", price: 19.9, quantity: 2, item_category: "Gaxetas" }],
      transaction_id: "PK-1",
      shipping: 10,
    },
  });
});

test("sem valor informado, o valor é a soma dos itens", () => {
  const carga = cargaGtm("add_to_cart", [{ id: "a", nome: "A", precoCentavos: 1000 }, { id: "b", nome: "B", precoCentavos: 250, quantidade: 2 }]);
  assert.equal(carga.ecommerce.value, 15);
  assert.equal("transaction_id" in carga.ecommerce, false);
import { entradasDoDataLayer, paraGa4, receitaDosItens } from "./eventos-loja";

const itens = [
  { id: "p1", nome: "Shampoo 1,5 L", precoCentavos: 4990, quantidade: 2, categoria: "Lavagem" },
  { id: "p2", nome: "Boina 6 pol", precoCentavos: 2500 },
];

test("o dataLayer recebe o evento no formato de e-commerce do GA4, com o reset antes", () => {
  const entradas = entradasDoDataLayer("purchase", itens, 12480, { transacao: "PED-1", frete: 2500 });
  assert.equal(entradas.length, 2);
  // Sem o `ecommerce: null`, o GTM mescla os itens do evento anterior.
  assert.deepEqual(entradas[0], { ecommerce: null });
  assert.deepEqual(entradas[1], {
    event: "purchase",
    ecommerce: {
      currency: "BRL",
      value: 124.8,
      transaction_id: "PED-1",
      shipping: 25,
      items: [
        { item_id: "p1", item_name: "Shampoo 1,5 L", price: 49.9, quantity: 2, item_category: "Lavagem" },
        { item_id: "p2", item_name: "Boina 6 pol", price: 25, quantity: 1, item_category: undefined },
      ],
    },
  });
});

test("evento sem transação não inventa transaction_id nem frete", () => {
  const [, evento] = entradasDoDataLayer("add_to_cart", [itens[1]], 2500) as [unknown, { ecommerce: Record<string, unknown> }];
  assert.equal("transaction_id" in evento.ecommerce, false);
  assert.equal("shipping" in evento.ecommerce, false);
  assert.deepEqual(evento.ecommerce.items, paraGa4([itens[1]]));
});

test("o value da compra é a receita dos itens: o frete sai e vai só em shipping", () => {
  // Pedido de R$ 124,80 com R$ 25,00 de frete: value 99,80, shipping 25.
  assert.equal(receitaDosItens(12480, 2500), 9980);
  assert.equal(receitaDosItens(12480, 0), 12480);
  // Frete negativo ou maior que o total não produz receita negativa.
  assert.equal(receitaDosItens(1000, -500), 1000);
  assert.equal(receitaDosItens(1000, 5000), 0);
});
