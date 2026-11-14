import assert from "node:assert/strict";
import test from "node:test";
import { logoPublicoParaSchema } from "./marca-schema";

const dados = { slug: "marca-qa", origem: "https://marca.example", origemPlataforma: "https://lojas.example" };

test("schema conserva upload público existente do mesmo tenant, incluindo variante", async () => {
  const lidas: string[] = [];
  const logo = "https://lojas.example/uploads/marca-qa/logo.png?w=480";
  const publico = await logoPublicoParaSchema({ ...dados, logo }, async chave => { lidas.push(chave); return Buffer.from("imagem existente"); });
  assert.equal(publico, logo);
  assert.deepEqual(lidas, ["marca-qa/logo.png"]);
});

test("schema omite upload ausente ou indisponível sem substituir a marca", async () => {
  for (const erro of [Object.assign(new Error("ausente"), { code: "ENOENT" }), new Error("armazenamento indisponível")]) {
    const publico = await logoPublicoParaSchema({ ...dados, logo: "/uploads/marca-qa/logo.webp" }, async () => { throw erro; });
    assert.equal(publico, null);
  }
  assert.equal(await logoPublicoParaSchema({ ...dados, logo: "/uploads/marca-qa/logo.webp" }, async () => Buffer.alloc(0)), null);
});

test("schema não lê outra loja, subpastas privadas ou travessia de caminhos", async () => {
  for (const logo of [
    "/uploads/outra/logo.webp", "/uploads/marca-qa/pix/comprovante.png",
    "/uploads/marca-qa/%2e%2e/logo.webp", "/uploads/marca-qa/a..png",
    "/uploads/marca-qa/logo.pdf", "/uploads/marca-qa/site.webmanifest",
    "/uploads", "https://lojas.example:8443/uploads/marca-qa/logo.png",
  ]) {
    assert.equal(await logoPublicoParaSchema({ ...dados, logo }, async () => { assert.fail("Não deve acessar arquivo recusado"); }), null, logo);
  }
});

test("schema mantém marcas estáticas e externas sem fazer requisição arbitrária", async () => {
  for (const [logo, esperado] of [["/media/marca/logo.svg", "https://marca.example/media/marca/logo.svg"], ["https://cdn.example/marca.webp", "https://cdn.example/marca.webp"]]) {
    assert.equal(await logoPublicoParaSchema({ ...dados, logo }, async () => { assert.fail("Não consulta URL externa ou arquivo fora de uploads"); }), esperado);
  }
  for (const logo of [null, "", "javascript:alert(1)", "data:image/png;base64,AA==", "https://usuario:senha@cdn.example/marca.webp"]) {
    assert.equal(await logoPublicoParaSchema({ ...dados, logo }), null);
  }
});
