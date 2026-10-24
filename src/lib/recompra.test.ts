import assert from "node:assert/strict";
import test from "node:test";
import { identidadeParaRecompra, montarRevisaoRecompra, type ItemAnterior } from "./recompra";
import { somarAoCarrinho } from "./carrinho-local";

const anterior: ItemAnterior = { id: "linha", produtoId: "p", varianteId: "v", varianteNome: "10 mm", nome: "Nome antigo", sku: "ABC", quantidade: 2, precoUnitarioCentavos: 1000 };
const oferta = { id: "p:v", nome: "Nome atual", sku: "ABC", quantidade: 2, precoUnitario: 1500 };
const slugs = new Map([["p", "nome-atual"]]);

test("recompra usa preço e nome atuais preservando o valor histórico para revisão", () => {
  const [item] = montarRevisaoRecompra([anterior], [oferta], slugs);
  assert.equal(item.oferta?.precoCentavos, 1500);
  assert.equal(item.oferta?.nome, "Nome atual");
  assert.equal(item.precoAnteriorCentavos, 1000);
  assert.equal(item.quantidade, 2);
});

test("não substitui variante apagada nem referência reaproveitada", () => {
  assert.equal(identidadeParaRecompra({ ...anterior, varianteId: null }), null);
  assert.equal(montarRevisaoRecompra([anterior], [{ ...oferta, sku: "OUTRO" }], slugs)[0].oferta, null);
  assert.equal(montarRevisaoRecompra([anterior], [{ ...oferta, sku: undefined }], slugs)[0].oferta, null);
  assert.equal(montarRevisaoRecompra([anterior], [{ ...oferta, id: "p:outra" }], slugs)[0].oferta, null);
  assert.equal(identidadeParaRecompra({ ...anterior, produtoId: null }), null);
});

test("item removido, quantidade inválida e oferta recusada ficam visíveis sem compra", () => {
  const [item] = montarRevisaoRecompra([anterior], [], slugs);
  assert.equal(item.oferta, null);
  assert.match(item.motivo!, /indisponível/);
  for (const quantidade of [0, -1, 1.5, 1000]) assert.equal(identidadeParaRecompra({ ...anterior, quantidade }), null);
});

test("legado simples aceita apenas a apresentação padrão resolvida pelo catálogo", () => {
  const legado = { ...anterior, varianteId: null, varianteNome: null };
  assert.equal(identidadeParaRecompra(legado), "p");
  assert.equal(montarRevisaoRecompra([legado], [oferta], slugs)[0].oferta?.id, "p:v");
});

test("adicionar várias linhas soma quantidades e atualiza preço já existente no carrinho", () => {
  const item = { id: "p:v", slug: "atual", nome: "Atual", precoCentavos: 1500 };
  const antes = [{ ...item, nome: "Antigo", precoCentavos: 1000, quantidade: 1 }];
  const depois = somarAoCarrinho(somarAoCarrinho(antes, item, 2), item, 3);
  assert.equal(depois.length, 1);
  assert.equal(depois[0].quantidade, 6);
  assert.equal(depois[0].precoCentavos, 1500);
  assert.equal(antes[0].quantidade, 1);
  assert.equal(antes[0].precoCentavos, 1000);
});
