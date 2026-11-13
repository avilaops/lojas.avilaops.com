import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";

async function simular(exigirHost, releaseReal, releaseEsperada) {
  const chamadas = [];
  const server = createServer((req, res) => {
    chamadas.push({ path: req.url, host: req.headers["x-forwarded-host"] });
    if (exigirHost && req.headers["x-forwarded-host"] !== "lojas.avilaops.com") { res.writeHead(400); res.end(); return; }
    if (req.url === "/api/health") { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "x-lojas-release": releaseReal }); res.end(JSON.stringify({ ok: true, banco: "ok", latenciaBancoMs: 1 })); return; }
    if (req.url === "/v1/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ status: "ok", version: "test" })); return; }
    if (req.url?.startsWith("/uploads/")) { res.writeHead(404); res.end(); return; }
    if (req.url === "/style.css") { res.writeHead(200, { "content-type": "text/css" }); res.end(".teste{color:red;}".repeat(100)); return; }
    res.writeHead(200, { "content-type": "text/html" }); res.end('<link rel="stylesheet" href="/style.css"><main>Plataforma</main>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const child = spawn(process.execPath, [path.resolve("scripts/smoke-publicacao.mjs"), origin], { env: { ...process.env, LOJAS_SMOKE_HOST: "lojas.avilaops.com", LOJAS_EXPECTED_RELEASE_ID: releaseEsperada, SMOKE_TENTATIVAS: "1", SMOKE_TIMEOUT_MS: "1000" }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.resume(); child.stderr.resume();
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    return { code, chamadas };
  } finally { await new Promise(resolve => server.close(resolve)); }
}
test("smoke verifica origem explícita usando o host lógico em saúde, HTML e CSS", async () => {
  const r = await simular(true, "release-atual", "release-atual");
  assert.equal(r.code, 0);
  assert.ok(r.chamadas.some(c => c.path === "/style.css"));
  assert.ok(r.chamadas.every(c => c.host === "lojas.avilaops.com"));
});
test("smoke rejeita resposta saudável de outra release", async () => {
  assert.equal((await simular(false, "release-anterior", "release-atual")).code, 1);
});
