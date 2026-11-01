import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, cp, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../..", import.meta.url));
const files = ["scripts/contracts/payload-report.mjs", "scripts/contracts/export-schema.ts", "scripts/contracts/payload-compatibility.mjs",
  "src/lib/api-cupom-contrato.ts", "src/lib/api-cupom.ts", "src/lib/api-resposta.ts", "src/lib/api-rotas.ts",
  "src/app/api/v1/vitrine/cupom/route.ts", "examples/contracts/cupom-v1.ts", "contracts/cupom.v1.json", "package-lock.json", "package.json"];
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
async function commit(root) {
  git(root, "init"); git(root, "add", ".");
  git(root, "-c", "user.name=CI", "-c", "user.email=ci@example.invalid", "commit", "-m", "synthetic fixture");
}

test("CLI usa baseline commitado mesmo se a cópia candidata ou o checkout base forem editados", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "payload-gate-"));
  try {
    const candidate = path.join(directory, "candidate"), baseline = path.join(directory, "baseline");
    for (const file of files) {
      await mkdir(path.dirname(path.join(candidate, file)), { recursive: true });
      await cp(path.join(project, file), path.join(candidate, file));
    }
    await commit(candidate);
    await symlink(path.join(project, "node_modules"), path.join(candidate, "node_modules"), "dir");
    await mkdir(path.join(baseline, "contracts"), { recursive: true });
    const previous = JSON.parse(await readFile(path.join(candidate, "contracts/cupom.v1.json"), "utf8"));
    previous.request.properties.codigo["x-maxLengthUtf16"] = 80;
    await writeFile(path.join(baseline, "contracts/cupom.v1.json"), JSON.stringify(previous));
    await commit(baseline);
    // Adulterar o worktree base não altera o contrato do seu commit.
    previous.request.properties.codigo["x-maxLengthUtf16"] = 40;
    await writeFile(path.join(baseline, "contracts/cupom.v1.json"), JSON.stringify(previous));
    const output = path.join(directory, "report");
    const run = () => spawnSync(process.execPath, ["--import", path.join(project, "node_modules/tsx/dist/loader.mjs"),
      path.join(candidate, "scripts/contracts/payload-report.mjs"), baseline, output], { encoding: "utf8", cwd: candidate });
    const incompatible = run();
    assert.equal(incompatible.status, 1, incompatible.stderr);
    const report = JSON.parse(await readFile(path.join(output, "cupom-compatibility.json"), "utf8"));
    assert.equal(report.compatible, false);
    assert.equal(report.baselineMode, "previous_commit");
    assert.ok(report.changes.some(change => change.path === "request.codigo" && change.reason === "x-maxLengthUtf16_not_subset"));
    assert.ok(report.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256)));
    const exportedBase = JSON.parse(await readFile(path.join(output, "cupom-baseline.json"), "utf8"));
    assert.equal(exportedBase.request.properties.codigo["x-maxLengthUtf16"], 80);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
