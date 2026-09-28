import assert from "node:assert/strict";
import test from "node:test";
import { compravel, disponibilidadeMerchant, elegivelMerchant, esgotado, estadoDeVenda, publicavel, sobConsulta } from "./produto-regras";

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

test("estado de venda: esgotado vence o preço zerado", () => {
  // Anel 2138 (Vedashow, código 2112): sem preço e sem estoque. O card
  // mostrava "Esgotado" e "Consultar preço"; a página, só "Consultar preço".
  const e = estadoDeVenda({ ...base, precoCentavos: 0, estoque: 0 }, { vende: false });
  assert.deepEqual(e, { esgotado: true, disponibilidade: "Indisponível no momento", acao: "aviso-reposicao" });
});

test("estado de venda: out_of_stock com saldo positivo continua esgotado", () => {
  const e = estadoDeVenda({ ...base, disponibilidade: "out_of_stock", estoque: 205 }, { vende: true });
  assert.equal(e.esgotado, true);
  assert.equal(e.acao, "aviso-reposicao");
});

test("estado de venda: com saldo e preço, a ação segue o modo de venda da loja", () => {
  // Anel 2007 (código 4919): 205 unidades, R$ 0,20, loja que vende pelo WhatsApp.
  const p = { ...base, precoCentavos: 20, estoque: 205 };
  assert.deepEqual(estadoDeVenda(p, { vende: false }), { esgotado: false, disponibilidade: "Em estoque", acao: "pedido" });
  assert.equal(estadoDeVenda(p, { vende: true }).acao, "carrinho");
});

test("estado de venda: sem preço com saldo é consulta, sem contagem é disponível", () => {
  assert.equal(estadoDeVenda({ ...base, precoCentavos: 0, estoque: 3 }, { vende: true }).acao, "consulta-preco");
  assert.equal(estadoDeVenda(base, { vende: true }).disponibilidade, "Disponível para compra");
  assert.equal(estadoDeVenda({ ...base, disponibilidade: "backorder" }, { vende: true }).disponibilidade, "Sob encomenda");
});

test("estado de venda: inativo nunca oferece pedido", () => {
  assert.equal(estadoDeVenda({ ...base, ativo: false, estoque: 10 }, { vende: true }).acao, "aviso-reposicao");
});

test("saldo negativo do ERP é esgotado, e o JSON-LD concorda", () => {
  const p = { ...base, estoque: -2 };
  assert.equal(esgotado(p), true);
  assert.equal(disponibilidadeMerchant(p), "out_of_stock");
});
