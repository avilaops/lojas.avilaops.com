import assert from "node:assert/strict";
import test from "node:test";
import { filtrarLojas } from "./busca-lojas";

const lojas = [
  { nome: "PK Vedações", slug: "pk", dominioPrincipal: "pkvedacoes.com.br" },
  { nome: "Loja Demo", slug: "demo", dominioPrincipal: null },
];

test("busca lojas ignorando caixa, acentos e espaços externos", () => {
  assert.deepEqual(filtrarLojas(lojas, "  VEDACOES  "), [lojas[0]]);
});

test("encontra pelo domínio ou slug sem domínio próprio", () => {
  assert.deepEqual(filtrarLojas(lojas, "pkvedacoes.com"), [lojas[0]]);
  assert.deepEqual(filtrarLojas(lojas, "demo"), [lojas[1]]);
});

test("consulta vazia conserva todas as lojas e sua ordem", () => {
  assert.deepEqual(filtrarLojas(lojas, "  "), lojas);
});

test("consulta sem correspondência retorna lista vazia sem alterar a origem", () => {
  assert.deepEqual(filtrarLojas(lojas, "inexistente"), []);
  assert.equal(lojas.length, 2);
  assert.deepEqual(filtrarLojas([], "demo"), []);
});
