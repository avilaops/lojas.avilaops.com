import assert from "node:assert/strict";
import test from "node:test";

// Falta da funcionalidade produz uma asserção explícita na primeira CI.
const implementation = await import("../../scripts/contracts/payload-compatibility.mjs").catch(() => null);
const compare = (before, after) => {
  assert.ok(implementation, "Comparador de payloads ainda não implementado");
  return implementation.comparePayloadSchemas(before, after);
};
const object = (properties, required = Object.keys(properties)) =>
  ({ type: "object", properties, required, additionalProperties: false });
const contract = (request, response = object({ total: { type: "integer", minimum: 0 } })) =>
  ({ request, response });

test("entrada rejeita estreitamento de limites e nova propriedade obrigatória", () => {
  const previous = contract(object({ quantidade: { type: "integer", minimum: 1, maximum: 999 } }));
  assert.equal(compare(previous, contract(object({ quantidade: { type: "integer", minimum: 2, maximum: 999 } }))).compatible, false);
  assert.equal(compare(previous, contract(object({ quantidade: { type: "integer", minimum: 1, maximum: 999 }, cep: { type: "string" } }))).compatible, false);
});

test("entrada pode ampliar faixa e acrescentar propriedade opcional", () => {
  const previous = contract(object({ quantidade: { type: "integer", minimum: 1, maximum: 50 } }));
  const next = contract(object({ quantidade: { type: "integer", minimum: 1, maximum: 999 }, cep: { type: "string" } }, ["quantidade"]));
  assert.equal(compare(previous, next).compatible, true);
});

test("saída não pode perder campo garantido ou ampliar tipo/enum", () => {
  const request = object({ codigo: { type: "string" } });
  const previous = contract(request, object({ tipo: { type: "string", enum: ["FIXO", "PERCENTUAL"] } }));
  assert.equal(compare(previous, contract(request, object({ tipo: { type: "string", enum: ["FIXO", "PERCENTUAL", "NOVO"] } }))).compatible, false);
  assert.equal(compare(previous, contract(request, object({ tipo: { type: "string", enum: ["FIXO"] } }, []))).compatible, false);
  assert.equal(compare(previous, contract(request, object({ tipo: { type: "string", enum: ["FIXO"] } }))).compatible, true);
});

test("arrays, objetos estritos e normalização participam do gate", () => {
  const previous = contract(object({ itens: { type: "array", minItems: 1, maxItems: 50, items: object({ id: { type: "string", "x-trim": true } }) } }));
  const next = structuredClone(previous);
  next.request.properties.itens.maxItems = 10;
  assert.equal(compare(previous, next).compatible, false);
  next.request.properties.itens.maxItems = 50;
  delete next.request.properties.itens.items.properties.id["x-trim"];
  assert.equal(compare(previous, next).compatible, false);
});

test("gate recusa schemas desconhecidos em vez de aprovar sem comparar", () => {
  assert.throws(() => compare(contract({ type: "string", pattern: "abc" }), contract({ type: "string" })), /UNSUPPORTED_SCHEMA/);
});

test("remoção de campo de entrada e inversão de inteiros não aprovam", () => {
  const previous = contract(object({ codigo: { type: "string" }, cep: { type: "string" } }, ["codigo"]));
  assert.equal(compare(previous, contract(object({ codigo: { type: "string" } }))).compatible, false);
  assert.equal(compare(contract({ type: "number" }), contract({ type: "integer" })).compatible, false);
  assert.equal(compare(contract({ type: "integer" }), contract({ type: "number" })).compatible, true);
});

test("extensão de saída é compatível quando o consumidor aceita campos adicionais", () => {
  const previous = contract({ type: "string" }, { ...object({ total: { type: "integer", minimum: 0 } }), additionalProperties: true });
  const next = contract({ type: "string" }, { ...object({ total: { type: "integer", minimum: 0 }, referencia: { type: "string" } }), additionalProperties: true });
  assert.equal(compare(previous, next).compatible, true);
});

test("obrigatoriedade, enum de entrada e limites inclusivos respeitam a direção", () => {
  assert.equal(compare(contract({ type: "string", enum: ["A"] }), contract({ type: "string", enum: ["A", "B"] })).compatible, true);
  assert.equal(compare(contract({ type: "string", enum: ["A", "B"] }), contract({ type: "string", enum: ["A"] })).compatible, false);
  assert.equal(compare(contract({ type: "integer", minimum: 0, maximum: 10 }), contract({ type: "integer", minimum: 0, maximum: 10 })).compatible, true);
  assert.throws(() => compare(contract({ type: "integer", minimum: 10, maximum: 0 }), contract({ type: "integer" })), /UNSUPPORTED_SCHEMA/);
});

test("limites UTF-16 diferem de pontos Unicode e detectam estreitamento", () => {
  const previous = contract({ type: "string", "x-maxLengthUtf16": 40 });
  assert.equal(compare(previous, contract({ type: "string", "x-maxLengthUtf16": 39 })).compatible, false);
  assert.equal(compare(contract({ type: "string", enum: ["😀"] }), contract({ type: "string", "x-maxLengthUtf16": 1 })).compatible, false);
  assert.equal(compare(contract({ type: "string", enum: ["😀"] }), contract({ type: "string", maxLength: 1 })).compatible, true);
});
