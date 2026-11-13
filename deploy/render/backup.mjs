import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { dividirArquivo, enviarArquivo } from "./release.mjs";

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
  const arquivo = path.join(pasta, "database.sql.gz");
  const nomes = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "PGOPTIONS", "PGCONNECT_TIMEOUT"];
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: "lojas", PGSSLMODE: "require", PGOPTIONS: "-c default_transaction_read_only=on", PGCONNECT_TIMEOUT: "10" };
  const dump = spawn("docker", ["run", "--rm", ...nomes.flatMap(name => ["--env", name]), "postgres:18-alpine", "pg_dump", "--no-owner", "--no-acl", "--no-password"], { env, stdio: ["ignore", "pipe", "inherit"] });
  const fim = new Promise((resolve, reject) => { dump.once("error", reject); dump.once("close", code => code === 0 ? resolve() : reject(new Error("POSTGRES_BACKUP_FAILED"))); });
  await Promise.all([pipeline(dump.stdout, createGzip({ level: 1 }), createWriteStream(arquivo)), fim]);
  const m = { schemaVersion: 1, database: "lojas", sha, runId, runAttempt: attempt, createdAt: new Date().toISOString(), ...await dividirArquivo(arquivo, pasta) };
  const prefixo = `${modo}/${sha}-${runId}-${attempt}`;
  for (const part of m.parts) await enviarArquivo("backups", `${prefixo}/${part.key}`, await readFile(path.join(pasta, part.key)));
  await enviarArquivo("backups", `${prefixo}/manifest.json`, Buffer.from(JSON.stringify(m)));
  console.log(JSON.stringify({ backup: prefixo, bytes: m.bytes, parts: m.parts.length, sha256: m.sha256 }));
}
executar().catch(error => { console.error(/^[A-Z_0-9]+$/.test(error?.message ?? "") ? error.message : "BACKUP_FAILED"); process.exitCode = 1; });
