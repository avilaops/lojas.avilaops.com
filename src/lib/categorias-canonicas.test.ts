import assert from "node:assert/strict";
import test from "node:test";
import { chaveCanonicaDaCategoria } from "./categorias-canonicas";

test("singular e plural de categorias verificadas compartilham a chave canônica", () => {
  assert.equal(chaveCanonicaDaCategoria("Rolamento"), "rolamento");
  assert.equal(chaveCanonicaDaCategoria("Rolamentos"), "rolamento");
  assert.equal(chaveCanonicaDaCategoria("Correia"), "correia");
  assert.equal(chaveCanonicaDaCategoria("Correias"), "correia");
  assert.equal(chaveCanonicaDaCategoria("Alicate"), "alicate");
  assert.equal(chaveCanonicaDaCategoria("Alicates"), "alicate");
});

test("grafias verificadas de O-ring compartilham a chave canônica", () => {
  assert.equal(chaveCanonicaDaCategoria("Anel O-Ring"), "anel-o-ring");
  assert.equal(chaveCanonicaDaCategoria("O-Rings"), "anel-o-ring");
  assert.equal(chaveCanonicaDaCategoria("o ring"), "anel-o-ring");
});

test("categoria sem alias preserva o slug normalizado", () => {
  assert.equal(chaveCanonicaDaCategoria("Rodas Dentadas"), "rodas-dentadas");
  assert.equal(chaveCanonicaDaCategoria("Gaxetas"), "gaxetas");
});
