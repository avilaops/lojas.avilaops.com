import test from "node:test";
import assert from "node:assert/strict";
import { plano, credencial, restaurar } from "./marca-publica.mjs";

test("pacote legítimo contém sete arquivos íntegros e somente a marca Vedashow", async () => {
  const arquivos = await plano();
  assert.equal(arquivos.length, 7);
  assert.ok(arquivos.every(a => a.url.startsWith("https://lojas-storage.nicolas-85b.workers.dev/uploads/vedashow/")));
  const manifest = JSON.parse(arquivos.find(a => a.nome === "site.webmanifest").bytes);
  assert.equal(manifest.name, "Vedashow");
  for (const icon of manifest.icons) assert.ok(arquivos.some(a => icon.src === `/uploads/vedashow/${a.nome}`));
});
test("consulta somente uma credencial do serviço existente e falha sem divulgar erro remoto", async () => {
  await assert.rejects(credencial(async url => {
    assert.equal(url, "https://api.render.com/v1/services/srv-dbrjmerm8hqs73d87570/env-vars/LOJAS_STORAGE_TOKEN");
    return new Response("segredo na resposta", { status: 403 });
  }, "api-key"), { message: "RENDER_ENV_403" });
});
test("preserva objeto existente sem PUT, inclusive quando seu hash difere", async () => {
  let chamadas = 0;
  const resultado = await restaurar((await plano()).slice(0, 1), "fake-token", true, async (_, opts) => {
    chamadas++; assert.equal(opts.method, "HEAD"); return new Response(null, { status: 200 });
  });
  assert.equal(chamadas, 1);
  assert.equal(resultado[0].estado, "existente_preservado");
});
test("auditoria não escreve e falhas HTTP não viram ausência", async () => {
  const arquivos = (await plano()).slice(0, 1);
  await restaurar(arquivos, "fake-token", false, async (_, opts) => {
    assert.equal(opts.method, "HEAD"); return new Response(null, { status: 404 });
  });
  await assert.rejects(restaurar(arquivos, "fake-token", true, async () => new Response(null, { status: 503 })), { message: "STORAGE_HEAD_503" });
});
test("restaura só ausentes e verifica os bytes devolvidos", async () => {
  const [arquivo] = await plano();
  const metodos = [];
  const resultado = await restaurar([arquivo], "fake-token", true, async (_, opts) => {
    metodos.push(opts.method);
    if (opts.method === "HEAD") return new Response(null, { status: 404 });
    if (opts.method === "PUT") { assert.deepEqual(opts.body, arquivo.bytes); return new Response(null, { status: 204 }); }
    return new Response(arquivo.bytes);
  });
  assert.deepEqual(metodos, ["HEAD", "PUT", "GET"]);
  assert.equal(resultado[0].estado, "restaurado_verificado");
  await assert.rejects(restaurar([{ ...arquivo, url: arquivo.url.replace("vedashow", "outro") }], "fake-token", true), { message: "INVALID_RESTORE_TARGET" });
});
