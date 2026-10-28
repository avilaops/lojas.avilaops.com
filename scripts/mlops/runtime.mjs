import { readdir } from "node:fs/promises";
import { readReference } from "./project.mjs";

const fail = code => { throw new Error(code); };

/** A trusted CI adapter binds test records to this checkout, plan, run and artifact bytes. */
export async function assessRuntimeChecks(root, structure, directory, runId, { assessFlow, fingerprint, verifyFlowArtifact }) {
  if (!runId || !/^[a-f0-9]{40,64}$/.test(structure.sourceHead)) fail("INVALID_RUNTIME_CONTEXT");
  const plans = new Map(structure.modules.flatMap(component => component.flows.map(flow => [flow.plan.id, flow.plan])));
  const files = new Map(structure.files.map(file => [file.path, file.sha256]));
  const observations = new Map([...plans.keys()].map(id => [id, []]));
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.length > 1000 || entries.some(entry => !entry.isFile())) fail("UNSAFE_RUNTIME_DIRECTORY");
  for (const entry of entries.filter(entry => entry.name.endsWith(".check.json"))) {
    const raw = JSON.parse((await readReference(directory, entry.name)).bytes);
    const plan = plans.get(raw.flowId);
    if (raw.schemaVersion !== "lojas-runtime-check/1" || !plan || raw.sourceHead !== structure.sourceHead
      || raw.runId !== runId || raw.environment !== "local_isolated") fail("FOREIGN_RUNTIME_RECORD");
    if (!/^[a-z0-9-]+$/.test(raw.flowId) || !/^[a-z0-9-]+$/.test(raw.checkId)
      || entry.name !== `${raw.flowId}--${raw.checkId}.check.json`
      || raw.artifact !== `${raw.flowId}--${raw.checkId}.artifact.json`) fail("UNSAFE_RUNTIME_RECORD");
    const check = plan.checks.find(check => check.id === raw.checkId);
    if (!check || check.method !== "runtime_assertion") fail("UNKNOWN_RUNTIME_CHECK");
    if (!raw.planPath?.startsWith(".agents/mlops/flows/") || files.get(raw.planPath) !== raw.planSha256) fail("FOREIGN_RUNTIME_PLAN");
    const currentPlan = await readReference(root, raw.planPath);
    if (currentPlan.sha256 !== raw.planSha256 || fingerprint(JSON.parse(currentPlan.bytes)) !== fingerprint(plan)) fail("FOREIGN_RUNTIME_PLAN");
    const artifact = await readReference(directory, raw.artifact);
    if (!verifyFlowArtifact({ artifactSha256: raw.artifactSha256 }, artifact.bytes)) fail("RUNTIME_ARTIFACT_MISMATCH");
    const result = JSON.parse(artifact.bytes);
    if (result.schemaVersion !== "lojas-test-artifact/1" || result.flowId !== raw.flowId || result.checkId !== raw.checkId
      || !result.assertions || typeof result.assertions !== "object" || Array.isArray(result.assertions) || !Object.keys(result.assertions).length
      || Object.values(result.assertions).some(value => value !== true)) fail("INVALID_RUNTIME_ASSERTIONS");
    observations.get(raw.flowId).push({ runId, sourceFingerprint: structure.sourceFingerprint,
      environment: raw.environment, planHash: fingerprint(plan), checkId: raw.checkId,
      status: "passed", method: "runtime_assertion", artifactSha256: raw.artifactSha256 });
  }
  return {
    schemaVersion: "lojas-runtime-assessment/1", runId,
    flows: [...plans.values()].map(plan => assessFlow(plan, { runId, sourceFingerprint: structure.sourceFingerprint,
      environment: "local_isolated", planHash: fingerprint(plan) }, observations.get(plan.id))),
    limitations: ["CI test declarations are verified against checkout, plan and artifact bytes; this is not remote attestation.",
      "Checks without runtime observations remain not_run. No production or browser evidence is inferred."]
  };
}
