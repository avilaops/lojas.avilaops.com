import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };

export function resolveOwner(item, projectOwner, members) {
  const owner = item.assignee ?? item.owner ?? projectOwner;
  if (typeof owner !== "string" || !members.some(member => member.id === owner)) fail("UNKNOWN_OWNER");
  return { owner, inherited: item.assignee == null && item.owner == null };
}

/** Read only repository references. Never follows a reference outside the checkout. */
export async function readReference(root, relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative) || relative.includes("\\")
    || relative.split("/").some(part => !part || part === "." || part === "..")
    || relative.split("/").some(part => part.startsWith(".env"))
    || /^(?:\.git|node_modules|output|reports)(?:\/|$)/.test(relative)) fail("UNSAFE_REFERENCE");
  const canonicalRoot = await realpath(root);
  const file = await realpath(path.resolve(root, relative));
  const resolved = path.relative(canonicalRoot, file);
  if (resolved.startsWith("..") || path.isAbsolute(resolved)) fail("UNSAFE_REFERENCE");
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size > 4 * 1024 * 1024) fail("INVALID_REFERENCE");
  const bytes = await readFile(file);
  return { path: relative, sha256: hash(bytes), bytes };
}

export async function buildProjectReport(root, { validateProfile, assessFlow, fingerprint }) {
  const sources = new Map();
  async function read(relative) {
    if (!sources.has(relative)) sources.set(relative, await readReference(root, relative));
    return sources.get(relative);
  }
  const profile = JSON.parse((await read(".agents/mlops/project.json")).bytes);
  if (!validateProfile(profile)) fail("INVALID_PROJECT_PROFILE");
  await read(".agents/mlops/project.schema.json");
  const team = JSON.parse((await read(".agents/equipe/controle.json")).bytes);
  if (team.projectOwner !== profile.owner || !Array.isArray(team.members) || !Array.isArray(team.tasks)) fail("INVALID_PROJECT_OWNERSHIP");
  resolveOwner({}, profile.owner, team.members);
  const modules = new Map();
  for (const module of profile.modules) {
    if (modules.has(module.id)) fail("DUPLICATE_MODULE");
    modules.set(module.id, module);
    resolveOwner(module, profile.owner, team.members);
    if (module.state === "existing" && !module.sources.some(source => source.kind === "test")) fail("MISSING_TEST_REFERENCE");
  }
  const visited = new Set(), active = new Set();
  function visit(id) {
    if (!modules.has(id)) fail("UNKNOWN_MODULE_DEPENDENCY");
    if (active.has(id)) fail("CYCLIC_MODULE_DEPENDENCY");
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of modules.get(id).dependsOn) visit(dependency);
    active.delete(id); visited.add(id);
  }
  for (const id of modules.keys()) visit(id);
  for (const reference of profile.references) await read(reference);
  const plans = new Map();
  const ids = new Set();
  for (const module of profile.modules) {
    for (const source of module.sources) await read(source.path);
    for (const file of module.flows) {
      const plan = JSON.parse((await read(file)).bytes);
      if (plan.product !== profile.id || ids.has(plan.id)) fail("INVALID_FLOW_OWNERSHIP");
      const dimensions = new Set(plan.checks?.filter(check => check.required && check.method === "runtime_assertion").map(check => check.dimension));
      if (!["interface", "request", "authorization", "domain", "persistence", "effects", "failure", "response"].every(dimension => dimensions.has(dimension))) fail("INCOMPLETE_FLOW_PLAN");
      ids.add(plan.id); plans.set(file, plan);
    }
  }
  const files = [...sources.values()].map(({ path, sha256 }) => ({ path, sha256 })).sort((a, b) => a.path.localeCompare(b.path, "en"));
  const sourceFingerprint = fingerprint(files);
  const tasks = team.tasks.map(task => ({ id: task.id, ...resolveOwner(task, profile.owner, team.members), status: task.status }));
  return {
    schemaVersion: "development-structure/1", product: profile.id, owner: profile.owner,
    sourceFingerprint, files, tasks,
    modules: profile.modules.map(module => ({ id: module.id, name: module.name, ...resolveOwner(module, profile.owner, team.members),
      state: module.state, dependsOn: module.dependsOn,
      gaps: [...(module.state === "planned" ? ["implementation_pending"] : []), ...(!module.flows.length ? ["flow_plan_pending"] : []), "runtime_evidence_pending"],
      flows: module.flows.map(file => {
        const plan = plans.get(file);
        return assessFlow(plan, { runId: `structure-${sourceFingerprint}`, sourceFingerprint, environment: "source_inventory", planHash: fingerprint(plan) }, []);
      }) })),
    limitations: ["Structure validation does not execute product flows or confirm production readiness.",
      "Existing test files are references, not observations bound to flow checks.",
      "No model, external command, laboratory import or deployment is performed."]
  };
}
