import assert from "node:assert/strict";
import test from "node:test";
import { fichaDoProduto, formatarMm } from "./ficha";

test("medida sai formatada, com unidade e antes do resto", () => {
  const f = fichaDoProduto({ ncm: "40169300", alturaMm: "14.3", diametroInternoMm: "101.6", diametroExternoMm: "139.75" });
  assert.deepEqual(f.map((l) => [l.rotulo, l.valor]), [
    ["Diâmetro interno", "101,6 mm"],
    ["Diâmetro externo", "139,75 mm"],
    ["Altura", "14,3 mm"],
    ["NCM", "40169300"],
  ]);
  assert.equal(f[0].numero, 101.6);
  assert.equal(f[0].unidade, "mm");
});

test("chave interna do ERP não aparece", () => {
  const f = fichaDoProduto({ grupoLegado: "Diversos", _origem: "csv", unidade: "PC" });
  assert.deepEqual(f.map((l) => l.rotulo), ["Unidade de venda"]);
});

test("medida inválida some em vez de sair errada", () => {
  // O código lido como medida: melhor ausente que "5.176.168 mm".
  assert.deepEqual(fichaDoProduto({ diametroInternoMm: "5176168" }), []);
  assert.deepEqual(fichaDoProduto({ alturaMm: "0" }), []);
});

test("sem zeros à toa", () => {
  assert.equal(formatarMm(14), "14 mm");
  assert.equal(formatarMm(15.875), "15,875 mm");
});
