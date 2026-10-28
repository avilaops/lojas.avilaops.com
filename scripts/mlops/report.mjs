import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { buildProjectReport } from "./project.mjs";
import { assessRuntimeChecks } from "./runtime.mjs";

const [root, experiments, output, runtimeDirectory, runId] = process.argv.slice(2);
if (!root || !experiments || !output) throw new Error("Expected project, experiments and output directories");
await mkdir(output, { recursive: true });
try {
  const requireExperiments = createRequire(path.resolve(experiments, "package.json"));
  const Ajv = requireExperiments("ajv/dist/2020.js");
  const schema = JSON.parse(await readFile(path.resolve(root, ".agents/mlops/project.schema.json"), "utf8"));
  const validateProfile = new Ajv({ strict: true }).compile(schema);
  const { assessFlow, fingerprint, verifyFlowArtifact } = await import(pathToFileURL(path.resolve(experiments, "dist/index.js")));
  const head = directory => execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const report = { ...await buildProjectReport(root, { validateProfile, assessFlow, fingerprint }),
    sourceHead: head(root), experimentsCommit: head(experiments), recordedAt: new Date().toISOString() };
  if (runtimeDirectory || runId) {
    if (!runtimeDirectory || !runId) throw new Error("INCOMPLETE_RUNTIME_ARGUMENTS");
    report.runtime = await assessRuntimeChecks(root, report, runtimeDirectory, runId, { assessFlow, fingerprint, verifyFlowArtifact });
  }
  await writeFile(path.join(output, "development.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ product: report.product, owner: report.owner, modules: report.modules.length,
    inheritedTasks: report.tasks.filter(task => task.inherited).length, status: "structure_valid",
    runtime: report.runtime?.flows.map(flow => ({ id: flow.plan.id, verdict: flow.verdict, coverage: flow.coverage })) ?? "not_run" }));
} catch {
  await writeFile(path.join(output, "development-error.json"), JSON.stringify({ code: "DEVELOPMENT_STRUCTURE_INVALID" }));
  console.error("DEVELOPMENT_STRUCTURE_INVALID");
  process.exitCode = 1;
}
