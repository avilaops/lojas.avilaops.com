import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareOperations } from "./compatibility.mjs";

const [candidateRoot, baselineRoot, experimentsRoot, outputRoot] = process.argv.slice(2);
if (!candidateRoot || !baselineRoot || !experimentsRoot || !outputRoot) throw new Error("Expected candidate, baseline, experiments, output directories");
const { inventoryWeb, hash } = await import(pathToFileURL(path.resolve(experimentsRoot, "scripts/route-inventory/source.mjs")));
const gitHead = root => execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const toolsHead = gitHead(experimentsRoot);

async function capture(root) {
  const head = gitHead(root);
  const web = await inventoryWeb(path.resolve(root, "src/app"));
  const second = await inventoryWeb(path.resolve(root, "src/app"));
  if (JSON.stringify(web) !== JSON.stringify(second) || gitHead(root) !== head) throw new Error("SOURCE_CHANGED");
  // Metadata detects changes during collection, but does not make fingerprints host dependent.
  const { metadataFingerprint, ...content } = web;
  return { schemaVersion: "route-inventory/2", runId: randomUUID(), recordedAt: new Date().toISOString(),
    product: "lojas", source: { head, dirty: execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).length > 0,
      fingerprint: hash(JSON.stringify(content)), metadataFingerprint,
      scope: "src/app page and route source files only; imported helpers are outside this fingerprint" },
    tools: { experimentsCommit: toolsHead, node: process.version },
    web, api: null, machineLearningModelExecuted: false,
    limitations: ["Static source inventory; every entry remains not_run.",
      "No payload, permission, tenant isolation, runtime or business compatibility verdict.",
      "Double source scan is not an atomic filesystem snapshot."] };
}

await mkdir(outputRoot, { recursive: true });
try {
  const baseline = await capture(baselineRoot);
  const candidate = await capture(candidateRoot);
  const result = { schemaVersion: "lojas-route-compatibility/1", baselineHead: baseline.source.head,
    candidateHead: candidate.source.head, experimentsCommit: toolsHead,
    scope: "Explicit HTTP method exports under /api/v1; parameter names are preserved", ...compareOperations(baseline.web, candidate.web) };
  for (const [name, value] of [["baseline", baseline], ["inventory", candidate], ["compatibility", result]]) {
    await writeFile(path.join(outputRoot, `${name}.json`), JSON.stringify(value, null, 2));
  }
  console.log(JSON.stringify({ compatible: result.compatible, removed: result.removed, added: result.added,
    pendingStaticReview: result.review.length, baselineHead: result.baselineHead, candidateHead: result.candidateHead }));
  if (!result.compatible) process.exitCode = 1;
} catch {
  // Do not serialize raw exceptions, source bodies, or environment configuration.
  await writeFile(path.join(outputRoot, "error.json"), JSON.stringify({ code: "CONTRACT_CAPTURE_FAILED", compatible: false }));
  console.error("CONTRACT_CAPTURE_FAILED");
  process.exitCode = 1;
}
