import assert from "node:assert/strict";
import test from "node:test";
import { envioSchema, freteGratisGarantido } from "./envio-declarado";

const loja = (extra: Record<string, unknown> = {}) => ({ cepOrigem: "14010000", tabelaFrete: [], freteGratisAcima: 19900, despachoDiasUteis: 2, ...extra });

test("frete grátis só é afirmado quando o produto sozinho passa do valor", () => {
  assert.equal(freteGratisGarantido(loja(), 19900), true);
  assert.equal(freteGratisGarantido(loja(), 19899), false);
  assert.equal(freteGratisGarantido(loja({ freteGratisAcima: null }), 99900), false);
  // Preço zero é "sob consulta", não produto que ganhou frete.
  assert.equal(freteGratisGarantido(loja({ freteGratisAcima: 0 }), 0), false);
});

test("loja que não cota para o país inteiro não afirma frete nenhum", () => {
  assert.equal(freteGratisGarantido(loja({ cepOrigem: null }), 50000), false);
  assert.equal(freteGratisGarantido(loja({ cepOrigem: null, tabelaFrete: [{ ufs: ["SP"], preco: 1990, prazoDiasUteis: 3 }] }), 50000), false);
  assert.equal(freteGratisGarantido(loja({ cepOrigem: null, tabelaFrete: [{ ufs: ["*"], preco: 1990, prazoDiasUteis: 3 }] }), 50000), true);
});

test("o schema sai com frete zero para o Brasil e só o prazo de despacho", () => {
  assert.equal(envioSchema(loja(), 100), undefined);
  const s = envioSchema(loja(), 25000)!;
  assert.equal(s.shippingRate.value, "0.00");
  assert.equal(s.shippingDestination.addressCountry, "BR");
  assert.equal(s.deliveryTime.handlingTime.maxValue, 2);
  assert.equal("transitTime" in s.deliveryTime, false);
});
