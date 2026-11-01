import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildProjectReport, readReference, resolveOwner } from "./project.mjs";

const experiments = path.resolve(process.env.EXPERIMENTS_ROOT);
const Ajv = createRequire(path.join(experiments, "package.json"))("ajv/dist/2020.js");
const schema = JSON.parse(await readFile(new URL("../../.agents/mlops/project.schema.json", import.meta.url), "utf8"));
const validateProfile = new Ajv({ strict: true }).compile(schema);
const { assessFlow, fingerprint } = await import(pathToFileURL(path.join(experiments, "dist/index.js")));
const dependencies = { validateProfile, assessFlow, fingerprint };
const members = [{ id: "codex" }, { id: "reviewer" }];

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "lojas-structure-"));
  try {
    const profile = { schemaVersion: "development-project/1", id: "lojas", owner: "codex", references: ["docs/reference.md"],
      modules: [{ id: "commerce", name: "Commerce", state: "existing", dependsOn: [],
        sources: [{ kind: "test", path: "test/example.test.mjs" }], flows: ["flow.json"] }] };
    const team = { projectOwner: "codex", members, tasks: [{ id: "inherited", assignee: null, owner: null, status: "a-fazer" }, { id: "explicit", assignee: "reviewer", status: "em-revisao" }] };
    const plan = { schemaVersion: "flow-plan/1", id: "commerce", product: "lojas", version: "1", reference: "docs/reference.md",
      checks: ["interface", "request", "authorization", "domain", "persistence", "effects", "failure", "response"]
        .map(dimension => ({ id: dimension, dimension, required: true, method: "runtime_assertion", criterion: `Verify ${dimension}` })) };
    async function save() {
      for (const [file, content] of [[".agents/mlops/project.json", profile], [".agents/mlops/project.schema.json", schema], [".agents/equipe/controle.json", team], ["flow.json", plan]]) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), JSON.stringify(content));
      }
    }
    for (const file of ["docs/reference.md", "test/example.test.mjs"]) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), "fixture\n");
    }
    await save();
    await run({ root, profile, team, plan, save });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("responsável nulo herda Codex; atribuição explícita é preservada", () => {
  assert.deepEqual(resolveOwner({ assignee: null, owner: null }, "codex", members), { owner: "codex", inherited: true });
  assert.deepEqual(resolveOwner({ assignee: "reviewer" }, "codex", members), { owner: "reviewer", inherited: false });
  assert.equal(resolveOwner({ owner: "reviewer" }, "codex", members).owner, "reviewer");
  assert.throws(() => resolveOwner({ assignee: "invented" }, "codex", members), /UNKNOWN_OWNER/);
});
test("estrutura gera planos reais não executados, hashes e responsáveis efetivos", () => fixture(async ({ root }) => {
  const report = await buildProjectReport(root, dependencies);
  assert.equal(report.tasks[0].owner, "codex");
  assert.equal(report.tasks[1].owner, "reviewer");
  assert.equal(report.modules[0].flows[0].verdict, "not_run");
  assert.equal(report.modules[0].flows[0].coverage.not_run, 8);
  assert.ok(report.modules[0].flows[0].checks.every(check => check.artifactSha256 === null));
  assert.match(report.sourceFingerprint, /^[a-f0-9]{64}$/);
  const original = report.sourceFingerprint;
  await writeFile(path.join(root, "test/example.test.mjs"), "changed\n");
  assert.notEqual((await buildProjectReport(root, dependencies)).sourceFingerprint, original);
}));
test("dependência desconhecida e ciclos de módulos são recusados", () => fixture(async ({ root, profile, save }) => {
  profile.modules[0].dependsOn = ["unknown"];
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /UNKNOWN_MODULE_DEPENDENCY/);
  profile.modules[0].dependsOn = ["commerce"];
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /CYCLIC_MODULE_DEPENDENCY/);
}));
test("perfil inválido, módulo duplicado e ausência de teste falham", () => fixture(async ({ root, profile, save }) => {
  profile.extra = true;
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /INVALID_PROJECT_PROFILE/);
  delete profile.extra;
  profile.modules.push(structuredClone(profile.modules[0]));
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /DUPLICATE_MODULE/);
  profile.modules.pop();
  profile.modules[0].sources[0].kind = "code";
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /MISSING_TEST_REFERENCE/);
}));
test("produto errado ou dimensão funcional ausente não são planos válidos", () => fixture(async ({ root, plan, save }) => {
  plan.product = "erp";
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /INVALID_FLOW_OWNERSHIP/);
  plan.product = "lojas";
  plan.checks.pop();
  await save();
  await assert.rejects(buildProjectReport(root, dependencies), /INCOMPLETE_FLOW_PLAN/);
}));
test("fonte ausente, caminho externo, credencial e symlink externo são recusados", () => fixture(async ({ root }) => {
  await assert.rejects(readReference(root, "missing.ts"));
  for (const file of ["../outside", "/etc/passwd", ".env", "docs/../.env", "node_modules/library.js"]) {
    await assert.rejects(readReference(root, file), /UNSAFE_REFERENCE/);
  }
  await symlink(path.join(experiments, "package.json"), path.join(root, "outside-file"));
  await assert.rejects(readReference(root, "outside-file"), /UNSAFE_REFERENCE/);
}));
