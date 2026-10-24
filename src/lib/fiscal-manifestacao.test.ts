import assert from "node:assert/strict";
import { test } from "node:test";
import { envelopeManifestacao, lerRetornoManifestacao, montarManifestacao } from "./fiscal-manifestacao";

const CHAVE = "35261012345678000195550010000001231482917360";

test("manifestação: monta os quatro eventos e exige justificativa na operação não realizada", () => {
  for (const tipo of ["CIENCIA", "CONFIRMACAO", "DESCONHECIMENTO"] as const) {
    const evento = montarManifestacao({ tipo, chave: CHAVE, cnpj: "12345678000195", sequencia: 1, data: new Date("2026-10-24T15:00:00Z") });
    assert.match(evento.xml, /<tpAmb>1<\/tpAmb>/);
    assert.match(evento.xml, /<cOrgao>91<\/cOrgao>/);
  }
  assert.throws(() => montarManifestacao({ tipo: "NAO_REALIZADA", chave: CHAVE, cnpj: "12345678000195", sequencia: 1, data: new Date(), justificativa: "curta" }), /15 a 255/);
  assert.match(montarManifestacao({ tipo: "NAO_REALIZADA", chave: CHAVE, cnpj: "12345678000195", sequencia: 1, data: new Date(), justificativa: "Mercadoria não foi entregue ao destinatário." }).xml, /<xJust>/);
});

test("manifestação: interpreta aceite, rejeição e recusa resposta de outra chave", () => {
  const resposta = (codigo: string, chave = CHAVE) => `<retEnvEvento><cStat>128</cStat><retEvento><infEvento><cStat>${codigo}</cStat><xMotivo>resultado</xMotivo><chNFe>${chave}</chNFe>${codigo === "135" ? "<nProt>135260000099999</nProt>" : ""}</infEvento></retEvento></retEnvEvento>`;
  assert.deepEqual(lerRetornoManifestacao(resposta("135"), CHAVE), { aceita: true, codigo: "135", motivo: "resultado", protocolo: "135260000099999" });
  assert.equal(lerRetornoManifestacao(resposta("573"), CHAVE).aceita, false);
  assert.throws(() => lerRetornoManifestacao(resposta("135", "9".repeat(44)), CHAVE), /outra NF-e/);
  assert.throws(() => lerRetornoManifestacao("<!DOCTYPE x><retEnvEvento/>", CHAVE), /inválida/);
});

test("manifestação: envelope só aceita XML assinado", () => {
  assert.throws(() => envelopeManifestacao("<evento/>", "1"), /assinatura/);
});
