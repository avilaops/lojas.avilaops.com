import assert from "node:assert/strict";
import test from "node:test";
import { consultaDimensional, confereDimensoes, codigoExato, normalizarBusca, consultaParDeMedidas, confereParNoNome } from "./busca-tecnica";

test("medidas equivalentes conservam decimal e ordem", () => {
  for (const q of ["Retentor 35x52x8,5", "RETENTOR 35 mm × 52 mm × 8.5 mm", "retentor 35 X 52 X 8,50"]) {
    const c = consultaDimensional(q)!;
    assert.deepEqual(c.valores, [35, 52, 8.5]);
    assert.equal(c.texto, "retentor");
    assert.equal(confereDimensoes({ diametroInternoMm: "35", diametroExternoMm: "52", alturaMm: "8.5" }, c.valores), true);
    assert.equal(confereDimensoes({ diametroInternoMm: 52, diametroExternoMm: 35, alturaMm: 8.5 }, c.valores), false);
    assert.equal(confereDimensoes({ diametroInternoMm: 35, diametroExternoMm: 52, alturaMm: 8 }, c.valores), false);
  }
});
test("não converte polegadas, frações ou par ambíguo", () => {
  for (const q of ['1x2x3 pol', '1x2x3"', '1/2x3x4', '20x3,5']) assert.equal(consultaDimensional(q), null);
  assert.equal(confereDimensoes({}, [35, 52, 8.5]), false);
});
test("código exato não é substring nem perde zeros", () => {
  assert.equal(codigoExato({ atributos: { referencia: " UC209 " } }, "uc209"), true);
  assert.equal(codigoExato({ sku: "000560" }, "560"), false);
  assert.equal(codigoExato({ sku: "5465" }, "5465"), true);
  assert.equal(codigoExato({ variantes: [{ sku: null, mpn: "HE310", gtin: null }] }, "he310"), true);
  assert.equal(normalizarBusca("  VÁLVULA   pressão  "), "valvula pressao");
});

test("par de medidas só casa com o par explícito no nome, na mesma ordem", () => {
  const c = consultaParDeMedidas("Anel 20 x 3,5 mm")!;
  assert.deepEqual(c.valores, [20, 3.5]);
  assert.equal(confereParNoNome("Anel 20 mm × 3.5 mm NBR", c.valores), true);
  assert.equal(confereParNoNome("Anel 3,5x20", c.valores), false);
  assert.equal(confereParNoNome("Anel 20x30x3,5", c.valores), false);
  assert.equal(consultaParDeMedidas("20x30x3,5"), null);
});
