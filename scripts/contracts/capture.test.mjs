import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

test("captura real gera inventário aceito pelo Experiments e recusa remoção", async () => {
  const experiments = path.resolve(process.env.EXPERIMENTS_ROOT);
  const { parseRouteInventory } = await import(pathToFileURL(path.join(experiments, "dist/lab/route-inventories.js")));
  const directory = await mkdtemp(path.join(tmpdir(), "lojas-contracts-"));
  try {
    const roots = [path.join(directory, "candidate"), path.join(directory, "baseline")];
    for (const root of roots) {
      await mkdir(path.join(root, "src/app/api/v1/produtos"), { recursive: true });
      await writeFile(path.join(root, "src/app/api/v1/produtos/route.ts"), "export const GET = wrapper(async () => ({}));\n");
      execFileSync("git", ["init", root], { stdio: "ignore" });
      execFileSync("git", ["-C", root, "add", "."]);
      execFileSync("git", ["-C", root, "-c", "user.name=CI", "-c", "user.email=ci@example.invalid", "commit", "-m", "fixture"], { stdio: "ignore" });
    }
    const output = path.join(directory, "report");
    const run = () => spawnSync(process.execPath, [fileURLToPath(new URL("capture.mjs", import.meta.url)), ...roots, experiments, output], { encoding: "utf8" });
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    const report = JSON.parse(await readFile(path.join(output, "inventory.json"), "utf8"));
    const parsed = parseRouteInventory(report);
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].verification, "not_run");
    assert.equal(parsed.entries[0].handlerStatus, "needs_review");
    assert.equal(parsed.sourceDirty, false);
    await writeFile(path.join(roots[0], "src/app/api/v1/produtos/route.ts"), "export function POST() {}\n");
    const failure = run();
    assert.equal(failure.status, 1, failure.stderr);
    const diff = JSON.parse(await readFile(path.join(output, "compatibility.json"), "utf8"));
    assert.equal(diff.compatible, false);
    assert.deepEqual(diff.removed, ["GET /api/v1/produtos"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
