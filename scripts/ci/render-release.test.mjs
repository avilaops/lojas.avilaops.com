import { test } from "node:test";
import assert from "node:assert/strict";
import { validarManifesto } from "../../deploy/render/start.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const sha = "a".repeat(40);
function manifesto() { return { schemaVersion: 1, sha, runId: "123", runAttempt: "1", sha256: "b".repeat(64), bytes: 3, parts: [{ key: "part-00", sha256: "c".repeat(64), bytes: 3 }] }; }
test("manifesto de release exige SHA e partes de conteúdo verificável", () => {
  assert.deepEqual(validarManifesto(manifesto(), sha), manifesto());
  for (const mutar of [m => m.sha = "d".repeat(40), m => m.parts[0].key = "../segredo", m => m.parts[0].key = "https://outro.test/segredo", m => m.parts[0].bytes = 4, m => m.parts[0].sha256 = "invalido", m => m.parts = []]) {
    const m = manifesto(); mutar(m); assert.throws(() => validarManifesto(m, sha));
  }
});

test("runtime substitui o bootstrap, conserva PID e limita heap sem processo pai retido", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "lojas-runtime-memory-"));
  try {
    await writeFile(path.join(root, "server.js"), 'console.log(JSON.stringify({serverPid:process.pid,heap:require("node:v8").getHeapStatistics().heap_size_limit,arena:process.env.MALLOC_ARENA_MAX,sha:process.env.LOJAS_DEPLOY_ID}));');
    const moduleUrl = new URL("../../deploy/render/start.mjs", import.meta.url).href;
    const launcher = `import * as runtime from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify({bootstrapPid:process.pid}));runtime.substituirPeloServidor(${JSON.stringify(root)}, ${JSON.stringify(sha)}, process.env);`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", launcher], { encoding: "utf8", timeout: 10_000, env: { ...process.env, LOJAS_BOOTSTRAP_RUN: "0" } });
    assert.equal(result.status, 0, result.stderr);
    const [before, after] = result.stdout.trim().split("\n").map(JSON.parse);
    assert.equal(after.serverPid, before.bootstrapPid);
    assert.ok(after.heap <= 320 * 1024 ** 2, `Heap sem folga para memória nativa: ${after.heap}`);
    assert.equal(after.arena, "2");
    assert.equal(after.sha, sha);
  } finally { await rm(root, { recursive: true, force: true }); }
});
