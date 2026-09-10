import assert from "node:assert/strict";
import test from "node:test";
import { compravel, disponibilidadeMerchant, elegivelMerchant, esgotado, publicavel, sobConsulta } from "./produto-regras";

/**
 * As cinco perguntas que a vitrine faz a um produto, com o caso que cada
 * tela respondia diferente antes de existir este módulo.
 */

const base = { ativo: true, precoCentavos: 1890, imagens: ["a.webp"], disponibilidade: "in_stock", estoque: null };

test("estoque zero com disponibilidade in_stock não é comprável", () => {
  // Era o furo da página do produto: oferecia "Comprar" e o checkout recusava.
  assert.equal(compravel({ ...base, estoque: 0 }), false);
  assert.equal(esgotado({ ...base, estoque: 0 }), true);
});

test("sem contagem de estoque, in_stock é comprável", () => {
  assert.equal(compravel(base), true);
});

test("sob consulta não é comprável, mas é publicável", () => {
  const p = { ...base, precoCentavos: 0 };
  assert.equal(sobConsulta(p), true);
  assert.equal(compravel(p), false);
  assert.equal(publicavel(p), true);
});

test("sem foto e sem preço é cadastro de referência: fora do sitemap", () => {
  assert.equal(publicavel({ ...base, precoCentavos: 0, imagens: [] }), false);
  assert.equal(publicavel({ ...base, imagens: [] }), true);
});

test("Merchant exige foto e preço", () => {
  assert.equal(elegivelMerchant({ ...base, precoCentavos: 0 }), false);
  assert.equal(elegivelMerchant({ ...base, imagens: [] }), false);
  assert.equal(elegivelMerchant({ ...base, imagens: [] }, true), true);
});

test("backorder só quando a loja marcou backorder", () => {
  assert.equal(disponibilidadeMerchant({ disponibilidade: "backorder", estoque: 0 }), "backorder");
  assert.equal(disponibilidadeMerchant({ disponibilidade: "in_stock", estoque: 0 }), "out_of_stock");
  assert.equal(disponibilidadeMerchant({ disponibilidade: "in_stock", estoque: 5 }), "in_stock");
});
