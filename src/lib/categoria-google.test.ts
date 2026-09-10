import assert from "node:assert/strict";
import test from "node:test";
import { categoriaGoogle } from "./categoria-google";

test("põe cada categoria da Brilhax na prateleira certa", () => {
  assert.equal(categoriaGoogle("Lavagem"), 2590);
  assert.equal(categoriaGoogle("Polimento"), 2590);
  assert.equal(categoriaGoogle("Vitrificação"), 2643);
  assert.equal(categoriaGoogle("Proteção"), 2643);
  assert.equal(categoriaGoogle("Kits Completos"), 2895);
});

test("reconhece o vocabulário do ramo, não só o nome exato", () => {
  assert.equal(categoriaGoogle("Shampoo automotivo"), 2590);
  assert.equal(categoriaGoogle("Boinas e espumas"), 2590);
  assert.equal(categoriaGoogle("Coating cerâmico"), 2643);
  assert.equal(categoriaGoogle("Panos de microfibra"), 2894);
});

test("categoria de outro ramo não recebe prateleira chutada", () => {
  // Deixar o Google adivinhar é melhor do que afirmar a prateleira errada.
  assert.equal(categoriaGoogle("Retentores"), undefined);
  assert.equal(categoriaGoogle("Camisetas"), undefined);
});

test("não quebra com categoria ausente", () => {
  assert.equal(categoriaGoogle(null), undefined);
  assert.equal(categoriaGoogle(undefined), undefined);
  assert.equal(categoriaGoogle(""), undefined);
});
