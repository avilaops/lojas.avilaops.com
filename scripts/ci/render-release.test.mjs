import { test } from "node:test";
import assert from "node:assert/strict";
import { validarManifesto } from "../../deploy/render/start.mjs";
const sha = "a".repeat(40);
function manifesto() { return { schemaVersion: 1, sha, runId: "123", runAttempt: "1", sha256: "b".repeat(64), bytes: 3, parts: [{ key: "part-00", sha256: "c".repeat(64), bytes: 3 }] }; }
test("manifesto de release exige SHA e partes de conteúdo verificável", () => {
  assert.deepEqual(validarManifesto(manifesto(), sha), manifesto());
  for (const mutar of [m => m.sha = "d".repeat(40), m => m.parts[0].key = "../segredo", m => m.parts[0].key = "https://outro.test/segredo", m => m.parts[0].bytes = 4, m => m.parts[0].sha256 = "invalido", m => m.parts = []]) {
    const m = manifesto(); mutar(m); assert.throws(() => validarManifesto(m, sha));
  }
});
