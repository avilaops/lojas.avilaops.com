import assert from "node:assert/strict";
import test from "node:test";
import { observationsFromMap, parseTapTests } from "./flow-observations.mjs";

const run = {
  runId: "github-1-1",
  sourceFingerprint: "1".repeat(64),
  environment: "local_isolated",
  planHash: "2".repeat(64),
};
const plan = {
  id: "flow",
  checks: [
    { id: "first", method: "runtime_assertion" },
    { id: "second", method: "runtime_assertion" },
  ],
};

test("parser aceita somente resultados TAP de testes no nível principal", () => {
  const parsed = parseTapTests("TAP version 13\n# Subtest: primeiro\nok 1 - primeiro\n    ok 1 - interno\nnot ok 2 - segundo\nok 3 - terceiro # SKIP ambiente\n1..3\n");
  assert.deepEqual([...parsed], [["primeiro", "passed"], ["segundo", "failed"], ["terceiro", "skipped"]]);
});

test("mapa gera observações apenas para checks e testes explicitamente vinculados", () => {
  const mapping = { schemaVersion: "flow-evidence-map/1", flowId: "flow", checks: [
    { checkId: "first", tests: ["primeiro"] },
    { checkId: "second", tests: ["primeiro", "segundo"] },
  ] };
  const observations = observationsFromMap(mapping, new Map([["primeiro", "passed"], ["segundo", "failed"]]), run, "3".repeat(64), plan);
  assert.deepEqual(observations.map(item => [item.checkId, item.status]), [["first", "passed"], ["second", "failed"]]);
  assert.ok(observations.every(item => item.method === "runtime_assertion" && item.artifactSha256 === "3".repeat(64)));
});

test("mapa rejeita check duplicado, desconhecido ou teste ausente", () => {
  const tests = new Map([["primeiro", "passed"]]);
  const base = { schemaVersion: "flow-evidence-map/1", flowId: "flow", checks: [] };
  assert.throws(() => observationsFromMap({ ...base, checks: [{ checkId: "unknown", tests: ["primeiro"] }] }, tests, run, "3".repeat(64), plan), /INVALID_EVIDENCE_MAP/);
  assert.throws(() => observationsFromMap({ ...base, checks: [{ checkId: "first", tests: ["ausente"] }] }, tests, run, "3".repeat(64), plan), /MAPPED_TEST_NOT_FOUND/);
  assert.throws(() => observationsFromMap({ ...base, checks: [{ checkId: "first", tests: ["ignorado"] }] }, new Map([["ignorado", "skipped"]]), run, "3".repeat(64), plan), /MAPPED_TEST_NOT_EXECUTED/);
  assert.throws(() => observationsFromMap({ ...base, checks: [{ checkId: "first", tests: ["primeiro"] }, { checkId: "first", tests: ["primeiro"] }] }, tests, run, "3".repeat(64), plan), /INVALID_EVIDENCE_MAP/);
});
