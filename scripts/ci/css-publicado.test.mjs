import { test } from "node:test";
import assert from "node:assert/strict";
import { temRegrasCss } from "../lib/css-publicado.mjs";
test("chunk CSS pequeno de componente é válido, resposta HTML e arquivo vazio não", () => {
  assert.equal(temRegrasCss(".menu{display:flex;gap:12px}@media(max-width:760px){.menu{display:none}}"), true);
  assert.equal(temRegrasCss("/* build */"), false);
  assert.equal(temRegrasCss("<!doctype html><html><style>body{color:red}</style></html>"), false);
  assert.equal(temRegrasCss(""), false);
});
