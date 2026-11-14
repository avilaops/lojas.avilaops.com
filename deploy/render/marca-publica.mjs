import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const origem = "https://lojas-storage.nicolas-85b.workers.dev";
const servico = "srv-dbrjmerm8hqs73d87570";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export async function plano() {
  const raiz = new URL("./marca-publica/", import.meta.url);
  const arquivos = JSON.parse(await readFile(new URL("manifest.json", raiz), "utf8"));
  if (arquivos.length !== 7) throw new Error("INVALID_PUBLIC_ASSETS");
  const nomes = new Set();
  return Promise.all(arquivos.map(async item => {
    if (!/^(?:favicon-96x96\.png|favicon\.svg|favicon\.ico|apple-touch-icon\.png|site\.webmanifest|web-app-manifest-(?:192x192|512x512)\.png)$/.test(item.nome) || nomes.has(item.nome)) throw new Error("INVALID_PUBLIC_ASSET_NAME");
    nomes.add(item.nome);
    const bytes = await readFile(new URL(item.nome, raiz));
    if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error("INVALID_PUBLIC_ASSET_HASH");
    return { ...item, bytes, url: `${origem}/uploads/vedashow/${item.nome}` };
  }));
}

async function requisitar(fetcher, url, options) {
  return fetcher(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15_000) });
}

// Only this existing service's application credential is read; never enumerate env vars.
export async function credencial(fetcher, apiKey) {
  if (!apiKey) throw new Error("MISSING_RENDER_CREDENTIAL");
  const resposta = await requisitar(fetcher, `https://api.render.com/v1/services/${servico}/env-vars/LOJAS_STORAGE_TOKEN`, { headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" } });
  if (!resposta.ok) throw new Error(`RENDER_ENV_${resposta.status}`);
  const item = await resposta.json();
  if (item.key !== "LOJAS_STORAGE_TOKEN" || !/^[a-zA-Z0-9_-]{16,256}$/.test(item.value ?? "")) throw new Error("INVALID_STORAGE_CREDENTIAL");
  return item.value;
}

// Existing files are preserved. This operation is serialized by the manual workflow.
export async function restaurar(arquivos, token, aplicar, fetcher = fetch) {
  const resultado = [];
  for (const item of arquivos) {
    if (item.url !== `${origem}/uploads/vedashow/${item.nome}` || hash(item.bytes) !== item.sha256) throw new Error("INVALID_RESTORE_TARGET");
    const headers = { authorization: `Bearer ${token}` };
    const antes = await requisitar(fetcher, item.url, { method: "HEAD", headers });
    if (antes.status === 200) {
      resultado.push({ nome: item.nome, estado: "existente_preservado" });
      continue;
    }
    if (antes.status !== 404) throw new Error(`STORAGE_HEAD_${antes.status}`);
    if (!aplicar) { resultado.push({ nome: item.nome, estado: "ausente" }); continue; }
    if (antes.headers.get("x-lojas-create-only") !== "1") throw new Error("STORAGE_CREATE_ONLY_UNAVAILABLE");
    const envio = await requisitar(fetcher, item.url, { method: "PUT", headers: { ...headers, "if-none-match": "*", "content-type": item.mime, "content-length": String(item.bytes.length), "x-content-sha256": item.sha256 }, body: item.bytes });
    if (envio.status === 409) { resultado.push({ nome: item.nome, estado: "criado_por_outro_escritor_preservado" }); continue; }
    if (envio.status !== 204) throw new Error(`STORAGE_PUT_${envio.status}`);
    const depois = await requisitar(fetcher, item.url, { method: "GET", headers });
    if (depois.status !== 200 || hash(Buffer.from(await depois.arrayBuffer())) !== item.sha256) throw new Error("RESTORE_VERIFICATION_FAILED");
    const evidencia = { nome: item.nome, estado: "restaurado_verificado", sha256: item.sha256 };
    console.log(JSON.stringify(evidencia));
    resultado.push(evidencia);
  }
  return resultado;
}

async function estadoVinhos() {
  const url = new URL(process.env.RENDER_DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || decodeURIComponent(url.pathname) !== "/lojas") throw new Error("INVALID_READONLY_DATABASE");
  const env = { PATH: process.env.PATH, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: "lojas", PGSSLMODE: "require", PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=10000", PGCONNECT_TIMEOUT: "10" };
  const consulta = `BEGIN READ ONLY; SELECT json_build_object('slug',slug,'nome',nome,'status',status,'dominioPrincipal',"dominioPrincipal") FROM "Tenant" WHERE "dominioPrincipal" IN ('vinhosimperial.com','https://vinhosimperial.com') OR 'vinhosimperial.com'=ANY(dominios); ROLLBACK;`;
  const args = ["run", "--rm", ...Object.keys(env).filter(k => k !== "PATH").flatMap(k => ["--env", k]), "postgres:18-alpine", "psql", "-XAtq", "--no-password", "--set=ON_ERROR_STOP=1", "--command", consulta];
  const saida = await new Promise((resolve, reject) => {
    const child = spawn("docker", args, { env, stdio: ["ignore", "pipe", "ignore"], timeout: 40_000 });
    let texto = "";
    child.stdout.on("data", bytes => { texto += bytes; if (texto.length > 8192) child.kill(); });
    child.once("error", () => reject(new Error("READONLY_DATABASE_FAILED")));
    child.once("close", code => code === 0 ? resolve(texto.trim()) : reject(new Error("READONLY_DATABASE_FAILED")));
  });
  if (!saida) return { encontrado: false };
  const item = JSON.parse(saida);
  if (!/^(ATIVA|SUSPENSA|PROVISIONANDO|CANCELADA)$/.test(item.status)) throw new Error("INVALID_TENANT_STATE");
  return item;
}

async function executar() {
  const modo = process.argv[2];
  if (!["auditar", "restaurar-vedashow"].includes(modo)) throw new Error("INVALID_OPERATION");
  const arquivos = await plano();
  const vinhos = await estadoVinhos();
  const token = await credencial(fetch, process.env.RENDER_API_KEY);
  const resultado = await restaurar(arquivos, token, modo === "restaurar-vedashow");
  console.log(JSON.stringify({ vinhos, vedashow: resultado }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) executar().catch(error => {
  console.error(/^[A-Z_0-9]+$/.test(error?.message ?? "") ? error.message : "PUBLIC_BRAND_OPERATION_FAILED");
  process.exitCode = 1;
});
