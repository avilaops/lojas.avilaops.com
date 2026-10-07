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
});
