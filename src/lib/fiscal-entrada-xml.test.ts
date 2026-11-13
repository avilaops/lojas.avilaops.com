import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { interpretarNotaEntrada } from "./fiscal-entrada-xml";

const XML = readFileSync(new URL("../../tests/fixtures/nfe-entrada-qa.xml", import.meta.url), "utf8");

test("conferência fiscal preserva identificação, quantidades decimais e valores originais", () => {
  const nota = interpretarNotaEntrada(XML);
  assert.equal(nota.numero, "123");
  assert.equal(nota.destinatario.documento, "11222333000181");
  assert.equal(nota.fornecedor.nome, "FORNECEDOR SINTETICO QA");
  assert.equal(nota.total, "125.00");
  assert.equal(nota.itens.length, 2);
  assert.equal(nota.itens[0].numero, 1);
  assert.equal(nota.itens[0].quantidade, "2.0000");
  assert.equal(nota.itens[0].valorUnitario, "50.0000000000");
  assert.equal(nota.itens[0].gtin, null);
  assert.equal(nota.itens[0].cfop, "5102");
});

test("conferência não aceita resumo, documento denegado, XML inseguro ou chave divergente", () => {
  for (const xml of ["<resNFe/>", XML.replace("<cStat>100</cStat>", "<cStat>110</cStat>"),
    '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>' + XML,
    XML.replace(/<chNFe>\d+<\/chNFe>/, "<chNFe>" + "9".repeat(44) + "</chNFe>")]) {
    assert.throws(() => interpretarNotaEntrada(xml));
  }
});

test("itens repetidos ou valores inválidos nunca viram entrada de estoque", () => {
  assert.throws(() => interpretarNotaEntrada(XML.replace('nItem="2"', 'nItem="1"')));
  assert.throws(() => interpretarNotaEntrada(XML.replace("<qCom>2.0000</qCom>", "<qCom>-2</qCom>")));
  assert.throws(() => interpretarNotaEntrada(XML.replace("<vUnCom>50.0000000000</vUnCom>", "<vUnCom>NaN</vUnCom>")));
});
