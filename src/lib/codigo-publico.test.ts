import assert from "node:assert/strict";
import test from "node:test";
import { codigoPublico, rotuloDoCodigo } from "./codigo-publico";

test("referência gerada na importação não aparece", () => {
  assert.equal(codigoPublico("JARBAS-83e5db8f"), null);
  assert.equal(codigoPublico("WP-503"), "WP-503");
});

test("SKU igual ao GTIN é apresentado como EAN", () => {
  assert.equal(rotuloDoCodigo("7898511024485", "7898511024485"), "EAN");
  assert.equal(rotuloDoCodigo("WP-502", "7898970675075"), "Código");
  assert.equal(rotuloDoCodigo("2011004", "7898511027097"), "Código");
  assert.equal(rotuloDoCodigo("7898511024485", null), "Código");
});
