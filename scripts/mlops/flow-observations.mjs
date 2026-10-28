import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildProjectReport, readReference } from "./project.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };

export function parseTapTests(tap) {
  const results = new Map();
  for (const line of tap.replaceAll("\r\n", "\n").split("\n")) {
    const match = /^(ok|not ok) \d+ - (.+?)(?: # (SKIP|TODO)(?: .*)?)?$/.exec(line);
    if (!match) continue;
    const [, state, name, directive] = match;
    if (results.has(name)) fail("DUPLICATE_TEST_RESULT");
    results.set(name, directive ? "skipped" : state === "ok" ? "passed" : "failed");
  }
  return results;
}

export function observationsFromMap(mapping, tests, run, artifactSha256, plan) {
  if (mapping?.schemaVersion !== "flow-evidence-map/1" || mapping.flowId !== plan.id || !Array.isArray(mapping.checks)) {
    fail("INVALID_EVIDENCE_MAP");
  }
  const planChecks = new Map(plan.checks.map(check => [check.id, check]));
  const seen = new Set();
  return mapping.checks.map(entry => {
    if (!entry || typeof entry.checkId !== "string" || seen.has(entry.checkId)
      || !planChecks.has(entry.checkId) || !Array.isArray(entry.tests) || entry.tests.length === 0
      || new Set(entry.tests).size !== entry.tests.length
      || entry.tests.some(name => typeof name !== "string" || !name)) fail("INVALID_EVIDENCE_MAP");
    seen.add(entry.checkId);
    const states = entry.tests.map(name => {
      if (!tests.has(name)) fail("MAPPED_TEST_NOT_FOUND");
      if (tests.get(name) === "skipped") fail("MAPPED_TEST_NOT_EXECUTED");
      return tests.get(name);
    });
    return {
      ...run,
      checkId: entry.checkId,
      status: states.every(state => state === "passed") ? "passed" : "failed",
      method: "runtime_assertion",
      artifactSha256,
    };
  });
}

export async function buildFlowEvidence({ root, experiments, tapPath, outputDir, runId }) {
  const requireExperiments = createRequire(path.resolve(experiments, "package.json"));
  const Ajv = requireExperiments("ajv/dist/2020.js");
  const schema = JSON.parse(await readFile(path.resolve(root, ".agents/mlops/project.schema.json"), "utf8"));
  const validateProfile = new Ajv({ strict: true }).compile(schema);
  const { assessFlow, fingerprint, verifyFlowArtifact } = await import(pathToFileURL(path.resolve(experiments, "dist/index.js")));
  const project = await buildProjectReport(root, { validateProfile, assessFlow, fingerprint });
  const mappingReference = await readReference(root, ".agents/mlops/flows/cotacao-pedido.evidence.json");
  const mapping = JSON.parse(mappingReference.bytes);
  const planned = project.modules.flatMap(module => module.flows).find(flow => flow.plan.id === mapping.flowId);
  if (!planned) fail("FLOW_PLAN_NOT_FOUND");
  const tap = await readFile(tapPath);
  const artifactSha256 = sha256(tap);
  const run = {
    runId,
    sourceFingerprint: project.sourceFingerprint,
    environment: "local_isolated",
    planHash: fingerprint(planned.plan),
  };
  const observations = observationsFromMap(mapping, parseTapTests(tap.toString("utf8")), run, artifactSha256, planned.plan);
  if (!observations.every(observation => verifyFlowArtifact(observation, tap))) fail("ARTIFACT_HASH_MISMATCH");
  const verification = assessFlow(planned.plan, run, observations);
  const result = {
    schemaVersion: "flow-evidence-report/1",
    generatedAt: new Date().toISOString(),
    sourceHead: process.env.GITHUB_SHA ?? null,
    artifact: { path: path.basename(tapPath), sha256: artifactSha256 },
    verification,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "cotacao-pedido.json"), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const [root, experiments, tapPath, outputDir] = process.argv.slice(2);
  if (!root || !experiments || !tapPath || !outputDir) fail("EXPECTED_FLOW_EVIDENCE_ARGUMENTS");
  const runId = process.env.FLOW_RUN_ID;
  if (!runId) fail("FLOW_RUN_ID_REQUIRED");
  const result = await buildFlowEvidence({ root, experiments, tapPath, outputDir, runId });
  console.log(JSON.stringify({
    flow: result.verification.plan.id,
    verdict: result.verification.verdict,
    passed: result.verification.coverage.passed,
    notRun: result.verification.coverage.not_run,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
