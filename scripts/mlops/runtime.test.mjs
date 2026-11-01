import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assessRuntimeChecks } from "./runtime.mjs";

const experiments = path.resolve(process.env.EXPERIMENTS_ROOT);
const dependencies = await import(pathToFileURL(path.join(experiments, "dist/index.js")));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "lojas-runtime-"));
  const directory = path.join(root, "evidence");
  try {
    const planPath = ".agents/mlops/flows/cotacao-pedido.json";
    const bytes = await readFile(new URL("../../.agents/mlops/flows/cotacao-pedido.json", import.meta.url));
    const plan = JSON.parse(bytes);
    await mkdir(path.dirname(path.join(root, planPath)), { recursive: true });
    await writeFile(path.join(root, planPath), bytes);
    await mkdir(directory);
    const structure = { sourceHead: "a".repeat(40), sourceFingerprint: "b".repeat(64), files: [{ path: planPath, sha256: sha(bytes) }],
      modules: [{ flows: [{ plan }] }] };
    async function record(checkId = "idempotencia", overrides = {}) {
      const prefix = `${plan.id}--${checkId}`;
      const artifact = Buffer.from(JSON.stringify({ schemaVersion: "lojas-test-artifact/1", flowId: plan.id, checkId, assertions: { fixtureOnly: true } }));
      await writeFile(path.join(directory, `${prefix}.artifact.json`), artifact);
      const raw = { schemaVersion: "lojas-runtime-check/1", flowId: plan.id, checkId, runId: "123-1", sourceHead: structure.sourceHead,
        environment: "local_isolated", planPath, planSha256: sha(bytes), artifact: `${prefix}.artifact.json`, artifactSha256: sha(artifact), ...overrides };
      await writeFile(path.join(directory, `${prefix}.check.json`), JSON.stringify(raw));
      return raw;
    }
    const assess = () => assessRuntimeChecks(root, structure, directory, "123-1", dependencies);
    await run({ root, directory, structure, record, assess, plan });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("evidência parcial não aprova o fluxo inteiro e não inventa checks ausentes", () => fixture(async ({ record, assess }) => {
  await record();
  const report = await assess();
  assert.equal(report.flows[0].verdict, "inconclusive");
  assert.equal(report.flows[0].coverage.passed, 1);
  assert.equal(report.flows[0].coverage.not_run, 7);
  assert.equal(report.flows[0].originAuthenticated, false);
}));
test("sem observações o fluxo permanece não executado", () => fixture(async ({ assess }) => {
  assert.equal((await assess()).flows[0].verdict, "not_run");
}));
test("commit, execução ou ambiente diferentes são recusados", () => fixture(async ({ record, assess }) => {
  for (const overrides of [{ sourceHead: "c".repeat(40) }, { runId: "old-1" }, { environment: "production" }]) {
    await record("idempotencia", overrides);
    await assert.rejects(assess(), /FOREIGN_RUNTIME_RECORD/);
  }
}));
test("plano diferente e bytes de artefato alterados não contam como prova", () => fixture(async ({ record, assess, directory }) => {
  await record("idempotencia", { planSha256: "d".repeat(64) });
  await assert.rejects(assess(), /FOREIGN_RUNTIME_PLAN/);
  const raw = await record();
  await writeFile(path.join(directory, raw.artifact), "{}");
  await assert.rejects(assess(), /RUNTIME_ARTIFACT_MISMATCH/);
}));
test("check desconhecido e caminho de artefato externo são recusados", () => fixture(async ({ record, assess }) => {
  await record("idempotencia", { artifact: "../outside.json" });
  await assert.rejects(assess(), /UNSAFE_RUNTIME_RECORD/);
  await record();
  await record("unknown");
  await assert.rejects(assess(), /UNKNOWN_RUNTIME_CHECK/);
}));
test("o avaliador só aprova com observações para todas as dimensões obrigatórias", () => fixture(async ({ record, assess, plan }) => {
  // Synthetic records exercise the adapter; they are not product observations.
  for (const check of plan.checks) await record(check.id);
  assert.equal((await assess()).flows[0].verdict, "passed");
}));
