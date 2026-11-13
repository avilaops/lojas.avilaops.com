import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import path from "node:path";

export function validarManifesto(m, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || m?.schemaVersion !== 1 || m.sha !== sha || !/^\d+$/.test(m.runId ?? "") || !/^\d+$/.test(m.runAttempt ?? "")
    || !/^[a-f0-9]{64}$/.test(m.sha256 ?? "") || !Number.isSafeInteger(m.bytes) || m.bytes < 1 || m.bytes > 1024 ** 3
    || !Array.isArray(m.parts) || m.parts.length < 1 || m.parts.length > 32) throw new Error("INVALID_RELEASE_MANIFEST");
  let total = 0;
  for (const [i, p] of m.parts.entries()) {
    if (p.key !== `part-${String(i).padStart(2, "0")}` || !/^[a-f0-9]{64}$/.test(p.sha256 ?? "") || !Number.isSafeInteger(p.bytes) || p.bytes < 1 || p.bytes > 32 * 1024 ** 2) throw new Error("INVALID_RELEASE_PART");
    total += p.bytes;
  }
  if (total !== m.bytes) throw new Error("INVALID_RELEASE_SIZE");
  return m;
}

async function baixar(url, token, maximo) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!r.ok || !r.body || Number(r.headers.get("content-length")) > maximo) throw new Error("RELEASE_DOWNLOAD_FAILED");
  return r;
}

export function ambienteDaRelease(env, destino, sha) {
  return { ...env, NODE_ENV: "production", HOSTNAME: "0.0.0.0", PORT: env.PORT || "10000",
    ROTINAS_AGENDADOR: env.ROTINAS_AGENDADOR ?? "0", LOJAS_DEPLOY_ID: sha,
    FUNDO_MODELOS_DIR: path.join(destino, "modelos"),
    PRISMA_QUERY_ENGINE_LIBRARY: path.join(destino, "node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node"),
  };
}

async function iniciar() {
  const sha = process.env.LOJAS_RELEASE_SHA;
  const releaseId = process.env.LOJAS_RELEASE_ID;
  const hashManifesto = process.env.LOJAS_RELEASE_MANIFEST_SHA256;
  const origem = new URL(process.env.LOJAS_STORAGE_URL);
  if (origem.protocol !== "https:" || origem.username || origem.password || origem.pathname !== "/" || origem.search || origem.hash || !/^[a-f0-9]{40}$/.test(sha ?? "") || !/^[a-f0-9]{64}$/.test(hashManifesto ?? "") || !process.env.LOJAS_STORAGE_TOKEN || process.versions.node.split(".")[0] !== "22") throw new Error("INVALID_RELEASE_CONFIGURATION");
  if (!/^[a-f0-9]{40}-\d+-\d+$/.test(releaseId ?? "") || !releaseId.startsWith(`${sha}-`)) throw new Error("INVALID_RELEASE_ID");
  const prefixo = `${origem.origin}/releases/${releaseId}`;
  const manifestoResposta = await baixar(`${prefixo}/manifest.json`, process.env.LOJAS_STORAGE_TOKEN, 65536);
  const manifestoBytes = await manifestoResposta.arrayBuffer();
  if (manifestoBytes.byteLength > 65536 || createHash("sha256").update(Buffer.from(manifestoBytes)).digest("hex") !== hashManifesto) throw new Error("INVALID_RELEASE_MANIFEST_HASH");
  const manifesto = validarManifesto(JSON.parse(Buffer.from(manifestoBytes).toString("utf8")), sha);
  if (releaseId !== `${sha}-${manifesto.runId}-${manifesto.runAttempt}`) throw new Error("FOREIGN_RELEASE_MANIFEST");
  const pasta = path.join("/tmp", `lojas-release-${releaseId}`);
  await mkdir(pasta, { recursive: true });
  const arquivo = path.join(pasta, "runtime.tar.gz");
  const hash = createHash("sha256");
  async function* partes() {
    for (const p of manifesto.parts) {
      const r = await baixar(`${prefixo}/${p.key}`, process.env.LOJAS_STORAGE_TOKEN, p.bytes);
      const hashParte = createHash("sha256");
      let recebidos = 0;
      for await (const chunk of r.body) {
        recebidos += chunk.byteLength;
        if (recebidos > p.bytes) throw new Error("INVALID_RELEASE_PART_SIZE");
        hashParte.update(chunk); hash.update(chunk);
        yield chunk;
      }
      if (recebidos !== p.bytes || hashParte.digest("hex") !== p.sha256) throw new Error("INVALID_RELEASE_PART_HASH");
    }
  }
  await pipeline(partes(), createWriteStream(arquivo));
  if (hash.digest("hex") !== manifesto.sha256) throw new Error("INVALID_RELEASE_ARCHIVE_HASH");
  const destino = path.join(pasta, "runtime");
  await mkdir(destino, { recursive: true });
  const tar = spawn("tar", ["--extract", "--no-same-owner", "--file", "-", "--directory", destino], { stdio: ["pipe", "inherit", "inherit"] });
  const saiu = new Promise((resolve, reject) => { tar.once("error", reject); tar.once("close", code => code === 0 ? resolve() : reject(new Error("RELEASE_EXTRACT_FAILED"))); });
  await Promise.all([pipeline(createReadStream(arquivo), createGunzip(), tar.stdin), saiu]);
  const info = JSON.parse(await readFile(path.join(destino, "release-info.json"), "utf8"));
  if (info.sha !== sha) throw new Error("FOREIGN_RELEASE_ARCHIVE");
  await writeFile(path.join(pasta, "ready.json"), JSON.stringify({ sha, sha256: manifesto.sha256 }));
  if (spawnSync("openssl", ["version"], { stdio: "ignore" }).status !== 0) throw new Error("OPENSSL_RUNTIME_MISSING");
  const app = spawn(process.execPath, ["server.js"], { cwd: destino, stdio: "inherit", env: ambienteDaRelease(process.env, destino, sha) });
  for (const sinal of ["SIGTERM", "SIGINT"]) process.on(sinal, () => app.kill(sinal));
  app.once("error", () => process.exit(1));
  app.once("close", code => process.exit(code ?? 1));
}

if (process.env.LOJAS_BOOTSTRAP_RUN === "1") iniciar().catch(error => { console.error("[runtime]", /^[A-Z_]+$/.test(error?.message ?? "") ? error.message : "RELEASE_START_FAILED"); process.exitCode = 1; });
