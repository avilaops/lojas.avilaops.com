import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { comparePayloadSchemas } from "./payload-compatibility.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const [baselineDirectory, outputDirectory] = process.argv.slice(2);
if (!baselineDirectory || !outputDirectory) throw new Error("Expected baseline checkout and output directory");
const target = path.resolve(outputDirectory);
await mkdir(target, { recursive: true });
try {
  const imported = await import("./export-schema.ts");
  const { exportCupomContract } = imported.default ?? imported;
  const candidate = exportCupomContract();
  const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const baselineRoot = path.resolve(baselineDirectory);
  const baselineHead = git(baselineRoot, "rev-parse", "HEAD");
  const contractPath = "contracts/cupom.v1.json";
  // Read the committed baseline, never a candidate-supplied path or worktree edit.
  const tracked = git(baselineRoot, "ls-tree", "--name-only", "HEAD", "--", contractPath) === contractPath;
  const baselineBytes = tracked ? git(baselineRoot, "show", `HEAD:${contractPath}`) : await readFile(path.join(root, contractPath), "utf8");
  const baseline = JSON.parse(baselineBytes);
  const result = comparePayloadSchemas(baseline, candidate);
  const sources = [];
  for (const file of ["src/lib/api-cupom-contrato.ts", "src/lib/api-cupom.ts", "src/lib/api-resposta.ts", "src/lib/api-rotas.ts",
    "src/app/api/v1/vitrine/cupom/route.ts", "examples/contracts/cupom-v1.ts", "scripts/contracts/export-schema.ts",
    "scripts/contracts/payload-compatibility.mjs", "scripts/contracts/payload-report.mjs", "package-lock.json"]) {
    sources.push({ path: file, sha256: createHash("sha256").update(await readFile(path.join(root, file))).digest("hex") });
  }
  await writeFile(path.join(target, "cupom-contract.json"), JSON.stringify(candidate, null, 2));
  await writeFile(path.join(target, "cupom-baseline.json"), JSON.stringify(baseline, null, 2));
  const report = { schemaVersion: "lojas-payload-compatibility/1", operation: candidate.operation,
    candidateHead: git(root, "rev-parse", "HEAD"), baselineHead,
    baselineMode: tracked ? "previous_commit" : "initial_contract",
    baselineSha256: createHash("sha256").update(baselineBytes).digest("hex"),
    sources, node: process.version, ...result,
    limitations: ["Only coupon payloads; other operations retain route-only coverage.",
      "Schema compatibility is not business verification, authentication or deployment evidence.",
      ...(tracked ? [] : ["Initial baseline introduced here; no prior payload baseline exists."])] };
  await writeFile(path.join(target, "cupom-compatibility.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ compatible: result.compatible, changes: result.changes, baselineMode: report.baselineMode }));
  if (!result.compatible) process.exitCode = 1;
} catch {
  await writeFile(path.join(target, "cupom-error.json"), JSON.stringify({ compatible: false, code: "PAYLOAD_CONTRACT_GATE_FAILED" }));
  console.error("PAYLOAD_CONTRACT_GATE_FAILED");
  process.exitCode = 1;
}
