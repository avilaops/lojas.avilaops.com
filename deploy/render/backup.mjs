import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { dividirArquivo, enviarArquivo } from "./release.mjs";

async function concluir(child) {
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error("POSTGRES_BACKUP_FAILED")));
  });
}

async function executar() {
  const modo = process.argv[2];
  const sha = process.env.GITHUB_SHA;
  const runId = process.env.GITHUB_RUN_ID;
  const attempt = process.env.GITHUB_RUN_ATTEMPT;
  if (!["daily", "before-migration"].includes(modo) || !/^[a-f0-9]{40}$/.test(sha ?? "") || !/^\d+$/.test(runId ?? "") || !/^\d+$/.test(attempt ?? "")) throw new Error("INVALID_BACKUP_CONTEXT");
  const url = new URL(process.env.RENDER_DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || decodeURIComponent(url.pathname) !== "/lojas") throw new Error("INVALID_BACKUP_DATABASE");
  const pasta = path.join(tmpdir(), `lojas-backup-${modo}-${runId}-${attempt}`);
  await mkdir(pasta, { recursive: true });
  const arquivo = path.join(pasta, "database.dump.tar.gz");
  const nomes = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "PGOPTIONS", "PGCONNECT_TIMEOUT", "PGAPPNAME"];
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: "lojas", PGSSLMODE: "require", PGOPTIONS: "-c default_transaction_read_only=on", PGCONNECT_TIMEOUT: "10", PGAPPNAME: "lojas-backup" };
  const docker = ["run", "--rm", "--user", `${process.getuid()}:${process.getgid()}`, "--mount", `type=bind,source=${pasta},target=/backup`, ...nomes.flatMap(name => ["--env", name]), "postgres:18-alpine"];
  const startedAt = new Date().toISOString();
  // Directory mode shares the master's synchronized snapshot across all workers.
  // Never split tables into independent pg_dump snapshots or exclude history.
  await concluir(spawn("docker", [...docker, "pg_dump", "--format=directory", "--jobs=4", "--compress=gzip:1", "--no-owner", "--no-acl", "--no-password", "--file=/backup/snapshot"], { env, stdio: ["ignore", "inherit", "inherit"] }));
  console.log("POSTGRES_SNAPSHOT_COMPLETE");
  // Read every data item through pg_restore before making a manifest visible.
  await concluir(spawn("docker", [...docker, "pg_restore", "--no-owner", "--no-acl", "--file=/dev/null", "/backup/snapshot"], { env, stdio: ["ignore", "ignore", "inherit"] }));
  await concluir(spawn("tar", ["-C", pasta, "-czf", arquivo, "snapshot"], { stdio: ["ignore", "ignore", "inherit"] }));
  const m = { schemaVersion: 2, format: "pg_dump-directory-tar-gzip", database: "lojas", sha, runId, runAttempt: attempt, startedAt, createdAt: new Date().toISOString(), ...await dividirArquivo(arquivo, pasta) };
  const prefixo = `${modo}/${sha}-${runId}-${attempt}`;
  for (const part of m.parts) await enviarArquivo("backups", `${prefixo}/${part.key}`, await readFile(path.join(pasta, part.key)));
  await enviarArquivo("backups", `${prefixo}/manifest.json`, Buffer.from(JSON.stringify(m)));
  console.log(JSON.stringify({ backup: prefixo, bytes: m.bytes, parts: m.parts.length, sha256: m.sha256 }));
}
executar().catch(error => { console.error(/^[A-Z_0-9]+$/.test(error?.message ?? "") ? error.message : "BACKUP_FAILED"); process.exitCode = 1; });
