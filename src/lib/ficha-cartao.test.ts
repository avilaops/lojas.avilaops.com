import assert from "node:assert/strict";
import test from "node:test";
import { fichaCompactaDoProduto, unidadeDeVenda } from "./ficha-cartao";

test("retentor mostra as três medidas, perfil e material", () => {
  const linhas = fichaCompactaDoProduto({
    diametroInternoMm: 20,
    diametroExternoMm: 35,
    alturaMm: 7,
    perfil: "BR",
    material: "NBR",
    unidade: "UN",
  });

  assert.deepEqual(linhas.map((linha) => linha.chave), [
    "diametroInternoMm",
    "diametroExternoMm",
    "alturaMm",
    "material",
    "perfil",
  ]);
});

test("O-ring conserva material e dureza depois das medidas", () => {
  const linhas = fichaCompactaDoProduto({
    diametroInternoMm: 18.2,
    secaoMm: 2.4,
    material: "NBR",
    dureza: "70 Shore A",
  });

  assert.deepEqual(linhas.map((linha) => linha.chave), [
    "diametroInternoMm",
    "secaoMm",
    "material",
    "dureza",
  ]);
});

test("rolamento conserva dimensões e tipo de vedação", () => {
  const linhas = fichaCompactaDoProduto({
    diametroInternoMm: 20,
    diametroExternoMm: 47,
    larguraMm: 14,
    vedacao: "2RS",
  });

  assert.deepEqual(linhas.map((linha) => linha.chave), [
    "diametroInternoMm",
    "diametroExternoMm",
    "larguraMm",
    "vedacao",
  ]);
});

test("correia conserva perfil e comprimento explícitos", () => {
  const linhas = fichaCompactaDoProduto({ perfil: "3L", comprimentoMm: 762 });
  assert.deepEqual(linhas.map((linha) => linha.chave), ["comprimentoMm", "perfil"]);
});

test("unidade de venda aceita valor curto e descarta ausente ou excessivo", () => {
  assert.equal(unidadeDeVenda({ unidade: " UN " }), "UN");
  assert.equal(unidadeDeVenda({ unidadeVenda: "peça" }), "peça");
  assert.equal(unidadeDeVenda({ unidade: "" }), null);
  assert.equal(unidadeDeVenda({ unidade: "x".repeat(21) }), null);
});
