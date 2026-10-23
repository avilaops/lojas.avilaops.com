import assert from "node:assert/strict";
import test from "node:test";
import { configuracaoBuscaTecnica, facetasTecnicasCadastradas } from "./busca-tecnica-familia";

test("retentor pede as três medidas de montagem, perfil e material", () => {
  assert.deepEqual(configuracaoBuscaTecnica("Retentores"), {
    familia: "retentor",
    medidas: ["diametroInternoMm", "diametroExternoMm", "alturaMm"],
    atributos: ["perfil", "material"],
    codigo: true,
  });
});

test("O-ring troca externo e altura pela seção do cordão", () => {
  assert.deepEqual(configuracaoBuscaTecnica("Anéis O-Ring"), {
    familia: "oring",
    medidas: ["diametroInternoMm", "secaoMm"],
    atributos: ["material", "dureza"],
    codigo: true,
  });
});

test("rolamento combina código, dimensões e vedação", () => {
  assert.deepEqual(configuracaoBuscaTecnica("Rolamentos Industriais"), {
    familia: "rolamento",
    medidas: ["diametroInternoMm", "diametroExternoMm", "alturaMm"],
    atributos: ["vedacao"],
    codigo: true,
  });
});

test("correia usa perfil e comprimento, não o trio de diâmetros", () => {
  assert.deepEqual(configuracaoBuscaTecnica("Correias"), {
    familia: "correia",
    medidas: ["comprimentoMm"],
    atributos: ["perfil"],
    codigo: true,
  });
});

test("vedações hidráulicas no plural recebem o seletor técnico da família", () => {
  assert.deepEqual(configuracaoBuscaTecnica("Vedações Hidráulicas"), {
    familia: "vedacao-hidraulica",
    medidas: ["diametroInternoMm", "diametroExternoMm", "alturaMm"],
    atributos: ["perfil", "material"],
    codigo: true,
  });
});

test("categoria não técnica não recebe um seletor inventado", () => {
  assert.equal(configuracaoBuscaTecnica("Ferramentas"), null);
});

test("facetas usam somente valores cadastrados, sem vazios ou repetidos", () => {
  assert.deepEqual(facetasTecnicasCadastradas([
    { material: "NBR", dureza: "70 Shore A", vedacao: "2RS" },
    { material: " NBR ", dureza: "", vedacao: "2RS" },
    { material: "FKM", dureza: null, vedacao: 123 },
  ]), {
    material: ["FKM", "NBR"],
    dureza: ["70 Shore A"],
    vedacao: ["2RS"],
  });
});
