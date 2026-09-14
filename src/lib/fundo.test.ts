import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { removerFundo } from "./fundo.ts";

test("removedor interno trata uma imagem sem chamar outra aplicacao", async () => {
  const entrada = await sharp({ create: { width: 100, height: 100, channels: 4, background: "white" } })
    .composite([{ input: await sharp({ create: { width: 40, height: 50, channels: 4, background: "red" } }).png().toBuffer(), left: 30, top: 25 }])
    .png().toBuffer();
  const resultado = await removerFundo(entrada, { tamanho: 128, formato: "png" });
  const metadados = await sharp(resultado).metadata();
  assert.equal(metadados.width, 128);
  assert.equal(metadados.height, 128);
  assert.equal(metadados.format, "png");
});

test("removedor rejeita entrada vazia e dimensoes fora do limite", async () => {
  await assert.rejects(removerFundo(Buffer.alloc(0)), /30 MB/);
  await assert.rejects(removerFundo(Buffer.from("x"), { tamanho: 9000 }), /limite/);
});
