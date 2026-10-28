import assert from "node:assert/strict";
import test from "node:test";
import { compareOperations } from "./compatibility.mjs";

const handler = (path, declaredMethods = ["GET"], status = "needs_review") => ({
  path, declaredMethods, exports: declaredMethods.map(method => ({ method, status })),
});
const web = (...handlers) => ({ handlers, review: [], conflicts: [] });

test("remover método público falha mesmo quando a factory exige revisão", () => {
  assert.deepEqual(compareOperations(web(handler("/api/v1/produtos", ["GET", "POST"])), web(handler("/api/v1/produtos"))).removed,
    ["POST /api/v1/produtos"]);
});
test("renomear parâmetro público é incompatível; catch-all não substitui rota", () => {
  const result = compareOperations(web(handler("/api/v1/produtos/[id]")), web(handler("/api/v1/produtos/[sku]"), handler("/api/v1/[...resto]")));
  assert.equal(result.compatible, false);
});
test("adicionar operação preserva consumidores e expõe revisão pendente", () => {
  const result = compareOperations(web(handler("/api/v1/produtos")), web(handler("/api/v1/produtos", ["GET", "POST"])));
  assert.equal(result.compatible, true);
  assert.deepEqual(result.added, ["POST /api/v1/produtos"]);
  assert.equal(result.review.length, 2);
});
test("export não funcional e conflito bloqueiam; rotas internas ficam fora do gate", () => {
  assert.equal(compareOperations(web(handler("/api/v1/produtos")), web(handler("/api/v1/produtos", ["GET"], "not_callable"))).compatible, false);
  const candidate = web(handler("/api/v1/produtos"));
  candidate.conflicts.push({ sources: ["api/v1/produtos/route.ts"], reason: "equivalent_url_patterns" });
  assert.equal(compareOperations(web(handler("/api/v1/produtos")), candidate).compatible, false);
  assert.equal(compareOperations(web(handler("/api/v1/produtos"), handler("/api/interno")), web(handler("/api/v1/produtos"))).compatible, true);
});
test("erro sintático na API pública e baseline vazio não aprovam silenciosamente", () => {
  const candidate = web(handler("/api/v1/produtos"));
  candidate.review.push({ source: "api/v1/produtos/route.ts", reason: "handler_syntax_error" });
  assert.equal(compareOperations(web(handler("/api/v1/produtos")), candidate).compatible, false);
  assert.throws(() => compareOperations(web(), candidate), /EMPTY_PUBLIC_API/);
});
