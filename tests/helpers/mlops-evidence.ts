import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Called only after the test's runtime assertions; never serializes business objects. */
export async function registrarCheckCotacao(checkId: string, result: {
  assertions: Record<string, boolean>;
  metrics?: Record<string, number>;
}) {
  const directory = process.env.MLOPS_EVIDENCE_DIR;
  if (!directory) return;
  const runId = process.env.MLOPS_RUN_ID;
  if (!runId || !/^\d+-\d+$/.test(runId)) throw new Error("Identidade da execução MLOps ausente.");
  const root = path.resolve(process.cwd());
  const planPath = ".agents/mlops/flows/cotacao-pedido.json";
  const planBytes = await readFile(path.join(root, planPath));
  const plan = JSON.parse(planBytes.toString("utf8")) as { id: string; checks: Array<{ id: string }> };
  if (!plan.checks.some(check => check.id === checkId) || !/^[a-z0-9-]+$/.test(checkId)) throw new Error("Check MLOps desconhecido.");
  if (!Object.keys(result.assertions).length || Object.values(result.assertions).some(value => value !== true)
    || Object.values(result.metrics ?? {}).some(value => !Number.isFinite(value))) throw new Error("Resultado MLOps inválido.");
  const sourceHead = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const artifact = Buffer.from(JSON.stringify({ schemaVersion: "lojas-test-artifact/1", flowId: plan.id, checkId, ...result }));
  const prefix = `${plan.id}--${checkId}`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${prefix}.artifact.json`), artifact, { flag: "wx" });
  await writeFile(path.join(directory, `${prefix}.check.json`), JSON.stringify({
    schemaVersion: "lojas-runtime-check/1", flowId: plan.id, checkId, runId, sourceHead,
    environment: "local_isolated", planPath,
    planSha256: createHash("sha256").update(planBytes).digest("hex"),
    artifact: `${prefix}.artifact.json`, artifactSha256: createHash("sha256").update(artifact).digest("hex"),
  }), { flag: "wx" });
}
