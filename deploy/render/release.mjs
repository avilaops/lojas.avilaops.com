import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validarManifesto } from "./start.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export async function conferirEntregaAtual(env = process.env, buscar = fetch) {
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GITHUB_RUN_ID: id, GITHUB_REF_NAME: branch } = env;
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo ?? "") || !/^[a-f0-9]{40}$/.test(sha ?? "") || !/^\d+$/.test(id ?? "") || !branch || env.GITHUB_REF !== `refs/heads/${branch}` || !env.GITHUB_TOKEN) throw new Error("INVALID_DELIVERY_CONTEXT");
  const options = { headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15_000) };
  const ref = await buscar(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, options);
  if (!ref.ok) throw new Error("DELIVERY_CHECK_FAILED");
  if ((await ref.json()).object?.sha !== sha) throw new Error("SUPERSEDED_DEPLOYMENT");
  const runs = await buscar(`https://api.github.com/repos/${repo}/actions/workflows/deploy-production.yml/runs?branch=${encodeURIComponent(branch)}&per_page=100`, options);
  if (!runs.ok) throw new Error("DELIVERY_CHECK_FAILED");
  const result = await runs.json();
  if (!Array.isArray(result.workflow_runs)) throw new Error("DELIVERY_CHECK_FAILED");
  if (result.workflow_runs.some(run => ["push", "workflow_dispatch"].includes(run.event) && run.head_branch === branch && BigInt(run.id) > BigInt(id))) throw new Error("SUPERSEDED_DEPLOYMENT");
  return true;
}
export async function dividirArquivo(arquivo, saida) {
  await mkdir(saida, { recursive: true });
  const digest = createHash("sha256");
  const parts = [];
  let bytes = 0;
  for await (const chunk of createReadStream(arquivo, { highWaterMark: 32 * 1024 ** 2 })) {
    if (parts.length >= 32) throw new Error("ARCHIVE_TOO_LARGE");
    const key = `part-${String(parts.length).padStart(2, "0")}`;
    await writeFile(path.join(saida, key), chunk, { flag: "wx" });
    parts.push({ key, bytes: chunk.length, sha256: hash(chunk) });
    bytes += chunk.length;
    digest.update(chunk);
  }
  return { sha256: digest.digest("hex"), bytes, parts };
}

export async function enviarArquivo(area, chave, bytes, env = process.env) {
  const base = new URL(env.LOJAS_STORAGE_URL);
  if (base.protocol !== "https:" || base.pathname !== "/" || base.username || base.password || base.search || base.hash || !env.LOJAS_STORAGE_PUBLISH_TOKEN) throw new Error("INVALID_PUBLISH_CONFIGURATION");
  const r = await fetch(`${base.origin}/${area}/${chave}`, {
    method: "PUT", headers: { authorization: `Bearer ${env.LOJAS_STORAGE_PUBLISH_TOKEN}`, "content-type": "application/octet-stream", "x-content-sha256": hash(bytes) },
    body: bytes, redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (r.status !== 204) throw new Error(`OBJECT_UPLOAD_FAILED_${r.status}`);
}

async function empacotar(entrada, saida) {
  const sha = process.env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || process.platform !== "linux" || process.arch !== "x64" || process.versions.node.split(".")[0] !== "22") throw new Error("INVALID_CI_RUNTIME");
  for (const name of [".env", ".env.local", ".env.production"]) {
    try { await readFile(path.join(entrada, name)); } catch (e) { if (e.code === "ENOENT") continue; throw e; }
    throw new Error("ENV_FILE_IN_RUNTIME");
  }
  await readFile(path.join(entrada, "server.js"));
  await readFile(path.join(entrada, ".next/BUILD_ID"));
  await writeFile(path.join(entrada, "release-info.json"), JSON.stringify({ sha }));
  await mkdir(saida, { recursive: true });
  const arquivo = path.join(saida, "runtime.tar.gz");
  const tar = spawn("tar", ["--create", "--file", "-", "--directory", entrada, "."], { stdio: ["ignore", "pipe", "inherit"] });
  const fim = new Promise((resolve, reject) => { tar.once("error", reject); tar.once("close", code => code === 0 ? resolve() : reject(new Error("RUNTIME_PACK_FAILED"))); });
  await Promise.all([pipeline(tar.stdout, createGzip({ level: 1 }), createWriteStream(arquivo)), fim]);
  const manifesto = validarManifesto({ schemaVersion: 1, sha, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, nodeVersion: process.versions.node, ...await dividirArquivo(arquivo, saida) }, sha);
  await writeFile(path.join(saida, "manifest.json"), JSON.stringify(manifesto));
  await unlink(arquivo);
  console.log(JSON.stringify({ sha, bytes: manifesto.bytes, parts: manifesto.parts.length }));
}

async function carregarRelease(pasta) {
  await conferirEntregaAtual();
  const bytes = await readFile(path.join(pasta, "manifest.json"));
  const m = validarManifesto(JSON.parse(bytes.toString()), process.env.GITHUB_SHA);
  const releaseId = `${m.sha}-${m.runId}-${m.runAttempt}`;
  for (const p of m.parts) {
    const dados = await readFile(path.join(pasta, p.key));
    if (dados.length !== p.bytes || hash(dados) !== p.sha256) throw new Error("CORRUPT_RELEASE_PART");
    await enviarArquivo("releases", `${releaseId}/${p.key}`, dados);
  }
  await enviarArquivo("releases", `${releaseId}/manifest.json`, bytes);
  return { m, bytes, releaseId };
}

async function publicar(pasta) {
  const { m, bytes, releaseId } = await carregarRelease(pasta);
  const atualizacoes = {
    LOJAS_RELEASE_SHA: m.sha, LOJAS_RELEASE_ID: releaseId, LOJAS_RELEASE_MANIFEST_SHA256: hash(bytes),
    LOJAS_BOOTSTRAP_RUN: "1", NODE_VERSION: m.nodeVersion,
  };
  if (!/^srv-[a-z0-9]+$/.test(process.env.RENDER_SERVICE_ID ?? "") || !process.env.RENDER_API_KEY) throw new Error("INVALID_RENDER_CONFIGURATION");
  const endpoint = `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}`;
  await conferirEntregaAtual();
  for (const [key, value] of Object.entries(atualizacoes)) {
    const r = await fetch(`${endpoint}/env-vars/${key}`, { method: "PUT", headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ value }), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`RENDER_ENV_FAILED_${r.status}`);
  }
  const r = await fetch(`${endpoint}/deploys`, { method: "POST", headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ commitId: m.sha }), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`RENDER_DEPLOY_FAILED_${r.status}`);
  const deploy = await r.json();
  if (!/^dep-[a-z0-9]+$/.test(deploy.id ?? "")) throw new Error("INVALID_RENDER_DEPLOYMENT");
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `deploy_id=${deploy.id}\nrelease_id=${releaseId}\n`);
  console.log(JSON.stringify({ sha: m.sha, releaseId, deployId: deploy.id, status: deploy.status }));
}

async function verificarRender() {
  const { RENDER_SERVICE_ID: serviceId, RENDER_DEPLOY_ID: deployId, RENDER_API_KEY: token, GITHUB_SHA: sha } = process.env;
  if (!/^srv-[a-z0-9]+$/.test(serviceId ?? "") || !/^dep-[a-z0-9]+$/.test(deployId ?? "") || !token || !/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("INVALID_RENDER_VERIFICATION");
  const base = `https://api.render.com/v1/services/${serviceId}`;
  for (let i = 0; i < 14; i++) {
    const r = await fetch(`${base}/deploys/${deployId}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error("RENDER_VERIFICATION_FAILED");
    const d = await r.json();
    if (["build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"].includes(d.status)) throw new Error("RENDER_DEPLOYMENT_FAILED");
    if (d.status === "live") {
      if (d.commit?.id !== sha) throw new Error("FOREIGN_RENDER_DEPLOYMENT");
      const serviceResponse = await fetch(base, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
      if (!serviceResponse.ok) throw new Error("RENDER_ORIGIN_UNAVAILABLE");
      const service = await serviceResponse.json();
      const origin = new URL(service.serviceDetails?.url);
      if (origin.protocol !== "https:" || !origin.hostname.endsWith(".onrender.com") || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("INVALID_RENDER_ORIGIN");
      if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `origin=${origin.origin}\n`);
      console.log(JSON.stringify({ deployId, sha, status: d.status }));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error("RENDER_DEPLOYMENT_NOT_LIVE");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [acao, entrada, saida] = process.argv.slice(2);
  const tarefa = acao === "pack" ? empacotar(entrada, saida) : acao === "publish" ? publicar(entrada) : acao === "upload" ? carregarRelease(entrada).then(({ m, releaseId }) => console.log(JSON.stringify({ sha: m.sha, releaseId, bytes: m.bytes, parts: m.parts.length }))) : acao === "current" ? conferirEntregaAtual() : acao === "verify" ? verificarRender() : Promise.reject(new Error("INVALID_RELEASE_COMMAND"));
  tarefa.catch(error => { console.error(/^[A-Z_0-9]+$/.test(error?.message ?? "") ? error.message : "RELEASE_FAILED"); process.exitCode = 1; });
}
