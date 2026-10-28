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
