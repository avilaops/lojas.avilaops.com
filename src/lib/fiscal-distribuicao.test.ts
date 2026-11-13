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
  assert.throws(() => lerDistribuicao(resposta("137", "", "1.0")));
  assert.throws(() => lerDistribuicao(resposta("656", "", "-1")));
  assert.throws(() => lerDistribuicao(resposta("138")));
  assert.throws(() => lerDistribuicao(resposta("280")), /280/);
});

test("normaliza NSUs numéricos de1a15dígitos previstos na NT2014.002", () => {
  const fim = lerDistribuicao(resposta("137", "", "9", "10"));
  assert.equal(fim.ultimoNsu, "000000000000009");
  assert.equal(fim.maxNsu, "000000000000010");
  const bloqueio = lerDistribuicao(resposta("656", "", "25", ""));
  assert.equal(bloqueio.ultimoNsu, "000000000000025");
  assert.equal(bloqueio.maxNsu, "");
  const zero = lerDistribuicao(resposta("137", "", "0", "0"));
  assert.equal(zero.ultimoNsu, "000000000000000");
});

test("normaliza NSU curto do docZip sem alterar o XML original", () => {
  const original = '<resNFe><chNFe>' + '1'.repeat(44) + '</chNFe></resNFe>';
  const zip = gzipSync(original).toString("base64");
  const lote = `<loteDistDFeInt><docZip NSU="9" schema="resNFe_v1.01.xsd">${zip}</docZip></loteDistDFeInt>`;
  const dados = lerDistribuicao(resposta("138", lote, "9", "10"));
  assert.equal(dados.documentos[0].nsu, "000000000000009");
  assert.equal(dados.documentos[0].xml, original);
});

test("normalizar não aceita controle ausente, negativo, decimal ou acima de15dígitos", () => {
  for (const nsu of ["", "-1", "1.0", "1e2", "abc", "1".repeat(16)]) {
    assert.throws(() => lerDistribuicao(resposta("137", "", nsu, "25")), /controle de consulta inválido/);
  }
  assert.throws(() => lerDistribuicao(resposta("137", "", "10", "9")), /controle de consulta inválido/);
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
