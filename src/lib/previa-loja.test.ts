import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { carregarMarcaDaPrevia } from "./previa-loja";

const dados = { slug: "brilhax", origem: "https://marca.example", caminho: "/uploads/brilhax/apple-touch-icon.png" };

test("marca própria é lida por chave e normalizada para PNG de até180px", async () => {
  const bytes = await sharp({ create: { width: 360, height: 240, channels: 4, background: "#123456" } }).png().toBuffer();
  const lidas: string[] = [];
  const uri = await carregarMarcaDaPrevia(dados, async chave => { lidas.push(chave); return bytes; });
  assert.deepEqual(lidas, ["brilhax/apple-touch-icon.png"]);
  assert.match(uri ?? "", /^data:image\/png;base64,/);
  const imagem = await sharp(Buffer.from(uri!.split(",")[1], "base64")).metadata();
  assert.equal(imagem.format, "png");
  assert.equal(imagem.width, 180);
  assert.equal(imagem.height, 120);
});

test("URL absoluta própria vira chave de armazenamento sem fetch do endereço", async () => {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 4, background: "#ffffff" } }).webp().toBuffer();
  const lidas: string[] = [];
  const uri = await carregarMarcaDaPrevia({ ...dados, caminho: "https://marca.example/uploads/brilhax/logo.webp" }, async chave => { lidas.push(chave); return bytes; });
  assert.ok(uri?.startsWith("data:image/png;base64,"));
  assert.deepEqual(lidas, ["brilhax/logo.webp"]);
});

test("namespace alheio, URL externa, traversal e caminhos privados não provocam leitura", async () => {
  let leituras = 0;
  for (const caminho of [
    "/uploads/outra/apple-touch-icon.png", "/uploads/brilhax/pix/comprovante.png", "/fiscal/brilhax/a.png",
    "/uploads/brilhax/../outra/a.png", "/uploads/brilhax/%2e%2e/a.png", "/uploads/brilhax/%252e/a.png",
    "/uploads/brilhax/a.png?chave=1", "/uploads/brilhax/a.png#x", "/uploads/brilhax/a\\b.png",
    "https://outra.example/uploads/brilhax/a.png", "http://localhost/uploads/brilhax/a.png", "https://127.0.0.1/uploads/brilhax/a.png",
    "//localhost/uploads/brilhax/a.png", "https://usuario@marca.example/uploads/brilhax/a.png",
    "/uploads/brilhax/a.svg", "/uploads/brilhax/a.pdf", "/media/outra/apple-touch-icon.png",
  ]) {
    assert.equal(await carregarMarcaDaPrevia({ ...dados, caminho }, async () => { leituras++; return Buffer.alloc(0); }), null, caminho);
  }
  assert.equal(leituras, 0);
});

test("SVG disfarçado, bytes corrompidos e tipo divergente conservam fallback", async () => {
  const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#fff" } }).jpeg().toBuffer();
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://localhost/privado" /></svg>'), Buffer.from("não é imagem"), jpeg]) {
    assert.equal(await carregarMarcaDaPrevia(dados, async () => bytes), null);
  }
});

test("marca acima do teto de bytes ou dimensões é recusada", async () => {
  assert.equal(await carregarMarcaDaPrevia(dados, async () => Buffer.alloc(1024 * 1024 + 1)), null);
  const larga = await sharp({ create: { width: 5000, height: 1, channels: 4, background: "#fff" } }).png().toBuffer();
  assert.equal(await carregarMarcaDaPrevia(dados, async () => larga), null);
});

test("ausência ou indisponibilidade do armazenamento conserva fallback", async () => {
  for (const code of ["ENOENT", "STORAGE_UNAVAILABLE"]) {
    assert.equal(await carregarMarcaDaPrevia(dados, async () => { throw Object.assign(new Error("indisponível"), { code }); }), null);
  }
  let leituras = 0;
  assert.equal(await carregarMarcaDaPrevia({ ...dados, caminho: null }, async () => { leituras++; return Buffer.alloc(0); }), null);
  assert.equal(leituras, 0);
});
