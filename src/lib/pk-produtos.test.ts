import assert from "node:assert/strict";
import test from "node:test";
import { beneficiosPk, lerSelecaoPk, medidasPk, slugsComparacao } from "./pk-produtos";

test("seleção aceita no máximo três slugs e recusa entradas hostis", () => {
  assert.deepEqual(slugsComparacao(["anel-1", "gaxeta-2", "anel-1"]), ["anel-1", "gaxeta-2"]);
  for (const entrada of [["a", "b", "c", "d"], ["../produto"], ["A"], [123], "produto", [""], ["a?tenant=outro"]]) assert.equal(slugsComparacao(entrada), null);
});
test("storage inválido não restaura produtos arbitrários", () => {
  for (const valor of [null, "{", "null", '{"slug":"anel"}', '["a","b","c","d"]']) assert.deepEqual(lerSelecaoPk(valor), []);
  assert.deepEqual(lerSelecaoPk('["anel-1"]'), ["anel-1"]);
});
test("medidas aceitam decimais cadastrados e recusam valores incoerentes", () => {
  assert.deepEqual(medidasPk({ diametroInternoMm: "12,5", diametroExternoMm: 20, alturaMm: "4.5", secaoMm: 2 }), { di: 12.5, de: 20, altura: 4.5, secao: 2 });
  assert.deepEqual(medidasPk({ diametroInternoMm: 20, diametroExternoMm: 10, alturaMm: Infinity, secaoMm: -1 }), { di: null, de: null, altura: null, secao: null });
  assert.equal(medidasPk({ alturaMm: "0x20" }).altura, null);
  assert.equal(medidasPk({ alturaMm: 3001 }).altura, null);
});
test("benefícios exigem PK e família identificável, sem prometer desempenho", () => {
  assert.deepEqual(beneficiosPk("outra", "Anel guia", {}), []);
  assert.deepEqual(beneficiosPk("pkvedacoes", "Peça sem família", {}), []);
  assert.ok(beneficiosPk("pkvedacoes", "Anel guia", {}).length);
  for (const perfil of ["B", "BS", "STD"]) assert.ok(beneficiosPk("pkvedacoes", "Gaxeta", { perfil }).length);
  assert.ok(beneficiosPk("pkvedacoes", "Raspador D", {}).length);
  assert.deepEqual(beneficiosPk("pkvedacoes", "Raspador desconhecido", {}), []);
});

test("benefícios distinguem posições B, BS e STD e funções de guia e raspador", () => {
  assert.match(beneficiosPk("pkvedacoes", "Gaxeta B", {}).join(" "), /êmbolo ou haste/);
  assert.match(beneficiosPk("pkvedacoes", "Gaxeta BS", {}).join(" "), /vedação da haste/);
  assert.match(beneficiosPk("pkvedacoes", "Gaxeta STD", {}).join(" "), /vedação do êmbolo/);
  assert.match(beneficiosPk("pkvedacoes", "Anel guia", {}).join(" "), /contato entre superfícies metálicas/);
  assert.match(beneficiosPk("pkvedacoes", "Raspador D", {}).join(" "), /entrada de contaminantes/);
});
