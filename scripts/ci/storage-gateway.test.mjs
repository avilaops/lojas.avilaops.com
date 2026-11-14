import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import worker from "../../deploy/cloudflare/storage-worker.mjs";

const appToken = "app-token-sintetico-para-teste";
const publishToken = "publish-token-sintetico-para-teste";
function ambiente() {
  let acessos = 0;
  const dados = new Map();
  const bucket = {
    async get(key) { acessos++; return dados.get(key) ?? null; },
    async head(key) { acessos++; return dados.get(key) ?? null; },
    async put(key, body, options) {
      acessos++;
      if (options.onlyIf?.etagDoesNotMatch === "*" && dados.has(key)) return null;
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      const value = { body: bytes, size: bytes.length, httpEtag: '"etag"', httpMetadata: options.httpMetadata, customMetadata: options.customMetadata };
      dados.set(key, value); return value;
    },
    async delete(key) { acessos++; dados.delete(key); },
  };
  return { env: { UPLOADS: bucket, FISCAL: bucket, RELEASES: bucket, BACKUPS: bucket,
    APP_TOKEN_SHA256: createHash("sha256").update(appToken).digest("hex"),
    PUBLISH_TOKEN_SHA256: createHash("sha256").update(publishToken).digest("hex") }, acessos: () => acessos };
}
function request(path, method = "GET", token = appToken, body) {
  return new Request(`https://storage.example/${path}`, { method, headers: {
    authorization: `Bearer ${token}`, ...(body ? { "content-length": String(Buffer.byteLength(body)), "x-content-sha256": createHash("sha256").update(body).digest("hex") } : {}),
  }, ...(body ? { body } : {}) });
}

test("storage gateway rejeita acesso anônimo antes de consultar qualquer bucket", async () => {
  const a = ambiente();
  const resposta = await worker.fetch(new Request("https://storage.example/uploads/demo/foto.png"), a.env);
  assert.equal(resposta.status, 401);
  assert.equal(a.acessos(), 0);
  assert.equal(resposta.headers.get("cache-control"), "no-store");
});
test("storage gateway grava e lê bytes autenticados, inclusive chave privada Pix", async () => {
  const a = ambiente();
  for (const chave of ["uploads/demo/foto.png", "uploads/demo/pix/comprovante.pdf", "fiscal/v1/123/nfe/33/doc.xml"]) {
    assert.equal((await worker.fetch(request(chave, "PUT", appToken, "persistido"), a.env)).status, 204);
    const resposta = await worker.fetch(request(chave), a.env);
    assert.equal(await resposta.text(), "persistido");
    assert.equal(resposta.headers.get("cache-control"), "no-store");
    const head = await worker.fetch(request(chave, "HEAD"), a.env);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  }
});
test("publicador não lê comprovantes e aplicação não publica release ou backup", async () => {
  const a = ambiente();
  assert.equal((await worker.fetch(request("uploads/demo/pix/c.pdf", "GET", publishToken), a.env)).status, 403);
  assert.equal((await worker.fetch(request(`releases/${"a".repeat(40)}/part-00`, "PUT", appToken, "dados"), a.env)).status, 403);
  assert.equal((await worker.fetch(request("backups/daily/backup.sql.gz", "PUT", appToken, "dados"), a.env)).status, 403);
  assert.equal((await worker.fetch(request("fiscal/v1/doc.xml", "DELETE"), a.env)).status, 405);
  assert.equal(a.acessos(), 0);
});
test("gateway recusa caminhos ambíguos e preserva releases já publicados", async () => {
  const a = ambiente();
  for (const path of ["uploads/demo/a%2fb.png", "uploads/demo/a..png", "uploads//foto.png", "uploads/demo/foto.png?token=x"]) {
    assert.equal((await worker.fetch(request(path), a.env)).status, 400);
  }
  const key = `releases/${"a".repeat(40)}/part-00`;
  assert.equal((await worker.fetch(request(key, "PUT", publishToken, "original"), a.env)).status, 204);
  assert.equal((await worker.fetch(request(key, "PUT", publishToken, "original"), a.env)).status, 204);
  assert.equal((await worker.fetch(request(key, "PUT", publishToken, "outro"), a.env)).status, 409);
  assert.equal(await (await worker.fetch(request(key), a.env)).text(), "original");
});

test("upload condicional preserva bytes de outro escritor entre HEAD e PUT", async () => {
  const a = ambiente();
  const chave = "uploads/vedashow/favicon.svg";
  assert.equal((await worker.fetch(request(chave, "HEAD"), a.env)).status, 404);
  assert.equal((await worker.fetch(request(chave, "PUT", appToken, "criado-por-outro-escritor"), a.env)).status, 204);
  const envio = request(chave, "PUT", appToken, "restauracao");
  envio.headers.set("if-none-match", "*");
  assert.equal((await worker.fetch(envio, a.env)).status, 409);
  assert.equal(await (await worker.fetch(request(chave), a.env)).text(), "criado-por-outro-escritor");
});

test("upload condicional cria ausente, preservando autorização e PUT normal", async () => {
  const a = ambiente();
  const chave = "uploads/vedashow/favicon.svg";
  const envio = request(chave, "PUT", appToken, "original");
  envio.headers.set("if-none-match", "*");
  assert.equal((await worker.fetch(envio, a.env)).status, 204);
  const head = await worker.fetch(request(chave, "HEAD"), a.env);
  assert.equal(head.headers.get("x-lojas-create-only"), "1");
  const negado = request(chave, "PUT", publishToken, "outro");
  negado.headers.set("if-none-match", "*");
  assert.equal((await worker.fetch(negado, a.env)).status, 403);
  assert.equal((await worker.fetch(request(chave, "PUT", appToken, "edicao-normal"), a.env)).status, 204);
  assert.equal(await (await worker.fetch(request(chave), a.env)).text(), "edicao-normal");
});
