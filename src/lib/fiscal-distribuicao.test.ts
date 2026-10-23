import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { envelopeDistribuicao, envelopeDistribuicaoPorChave, lerDistribuicao } from "./fiscal-distribuicao";

function resposta(status: string, lote = "", nsu = "000000000000001", maxNsu = "000000000000002") {
  return `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult><retDistDFeInt><cStat>${status}</cStat><xMotivo>Resultado</xMotivo><ultNSU>${nsu}</ultNSU><maxNSU>${maxNsu}</maxNSU>${lote}</retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></s:Body></s:Envelope>`;
}

test("preserva NSU, chave e conteúdo XML do lote comprimido", () => {
  const chave = "1".repeat(44);
  const xml = `<resNFe><chNFe>${chave}</chNFe><xNome>Fornecedor</xNome></resNFe>`;
  const zip = gzipSync(xml).toString("base64");
  const dados = lerDistribuicao(resposta("138", `<loteDistDFeInt><docZip NSU="000000000000001" schema="resNFe_v1.01.xsd">${zip}</docZip></loteDistDFeInt>`));
  assert.equal(dados.documentos[0].xml, xml);
  assert.equal(dados.documentos[0].chave, chave);
  assert.equal(dados.documentos[0].nsu, "000000000000001");
});

test("aceita fim de consulta e bloqueio sem documentos", () => {
  assert.equal(lerDistribuicao(resposta("137")).documentos.length, 0);
  assert.equal(lerDistribuicao(resposta("656", "", "")).status, "656");
  assert.equal(lerDistribuicao(resposta("656", "", "000000000000005", "000000000000005")).ultimoNsu, "000000000000005");
});

test("recusa XML malformado, entidades, NSU inválido e rejeição fiscal", () => {
  assert.throws(() => lerDistribuicao("<erro>"));
  assert.throws(() => lerDistribuicao('<!DOCTYPE a [<!ENTITY b SYSTEM "file:///etc/passwd">]><a>&b;</a>'));
  assert.throws(() => lerDistribuicao(resposta("137", "", "1")));
  assert.throws(() => lerDistribuicao(resposta("656", "", "1")));
  assert.throws(() => lerDistribuicao(resposta("138")));
  assert.throws(() => lerDistribuicao(resposta("280")), /280/);
});

test("consulta somente produção com CNPJ, UF e NSU validados", () => {
  const xml = envelopeDistribuicao("12345678000190", "SP", "000000000000000");
  assert.match(xml, /<tpAmb>1<\/tpAmb>/);
  assert.match(xml, /<cUFAutor>35<\/cUFAutor>/);
  assert.throws(() => envelopeDistribuicao("<invalido>", "SP", "000000000000000"));
  assert.throws(() => envelopeDistribuicao("12345678000190", "XX", "000000000000000"));
});

test("recusa descompressão acima do teto por documento", () => {
  const zip = gzipSync(`<resNFe>${"a".repeat(2 * 1024 * 1024)}</resNFe>`).toString("base64");
  assert.throws(() => lerDistribuicao(resposta("138", `<loteDistDFeInt><docZip NSU="000000000000001" schema="resNFe_v1.01.xsd">${zip}</docZip></loteDistDFeInt>`)));
});

test("consulta individual por chave sem alterar o cursor incremental", () => {
  const chave = "3".repeat(44);
  const xml = envelopeDistribuicaoPorChave("60067738000106", "SP", chave);
  assert.match(xml, /<consChNFe>/);
  assert.match(xml, new RegExp(chave));
  assert.doesNotMatch(xml, /<distNSU>/);
  assert.throws(() => envelopeDistribuicaoPorChave("60067738000106", "SP", "invalida"));
});
