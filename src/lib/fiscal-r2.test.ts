import { test } from "node:test";
import assert from "node:assert/strict";
import { arquivoFiscalChave, arquivoFiscalR2Configurado, guardarArquivoFiscal, lerArquivoFiscal } from "./fiscal-r2";
const chave = "3".repeat(44);
test("arquivo fiscal é endereçado por CNPJ, chave, e formato", () => {
  assert.equal(arquivoFiscalChave("60067738000106", chave, "xml"), `v1/60067738000106/nfe/33/${chave}.xml`);
  assert.notEqual(arquivoFiscalChave("60067738000106", chave, "xml"), arquivoFiscalChave("60067738000106", chave, "pdf"));
  assert.throws(() => arquivoFiscalChave("invalido", chave, "xml"));
});
test("sem credencial R2 a persistência falha fechada e não acessa rede", async () => {
  assert.equal(arquivoFiscalR2Configurado({}), false);
  assert.equal(await guardarArquivoFiscal("60067738000106", chave, "xml", new TextEncoder().encode("abc"), {}), false);
  assert.equal(await lerArquivoFiscal("60067738000106", chave, "xml", {}), null);
});
