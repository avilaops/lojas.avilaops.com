import assert from "node:assert/strict";
import test from "node:test";
import { compravel, disponibilidadeMerchant, elegivelMerchant, esgotado, publicavel, sobConsulta, estoqueBaixo, rotuloDisponibilidade } from "./produto-regras";

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

test("casos do catálogo: saldo, selo, disponibilidade e compra concordam", () => {
  const casos = [
    {sku: "4919", estoque: 205, disponibilidade: "in_stock", precoCentavos: 20, tem: true},
    {sku: "1445", estoque: 0, disponibilidade: "out_of_stock", precoCentavos: 25, tem: false},
    {sku: "2259", estoque: 1, disponibilidade: "in_stock", precoCentavos: 3380, tem: true},
    {sku: "2254", estoque: 0, disponibilidade: "out_of_stock", precoCentavos: 3380, tem: false},
    {sku: "bloqueado", estoque: 1, disponibilidade: "out_of_stock", precoCentavos: 100, tem: false},
    {sku: "negativo", estoque: -1, disponibilidade: "in_stock", precoCentavos: 100, tem: false},
  ];
  for (const c of casos) {
    const p = {...base, ...c};
    assert.equal(compravel(p), c.tem, c.sku);
    assert.equal(esgotado(p), !c.tem, c.sku);
    assert.equal(rotuloDisponibilidade(p), c.tem ? "Em estoque" : "Indisponível no momento", c.sku);
    assert.equal(disponibilidadeMerchant(p), c.tem ? "in_stock" : "out_of_stock", c.sku);
    if (!c.tem) assert.equal(estoqueBaixo(p), false, c.sku);
  }
});
