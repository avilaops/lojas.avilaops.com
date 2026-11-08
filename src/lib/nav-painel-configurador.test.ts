import assert from "node:assert/strict";
import test from "node:test";
import { secoesDoPainel } from "./navegacao-painel";

test("fila sob medida aparece somente para loja com configurador ativo", () => {
  assert.equal(secoesDoPainel({ pixManual: false, configuradorSobMedida: false }).some((item) => item.href === "/painel/sob-medida"), false);
  assert.equal(secoesDoPainel({ pixManual: false, configuradorSobMedida: true }).some((item) => item.href === "/painel/sob-medida"), true);
});
