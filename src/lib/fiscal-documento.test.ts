import assert from "node:assert/strict";
import test from "node:test";
import { resumirDocumentoFiscal } from "./fiscal-documento";

test("resume documento resNFe para a lista fiscal", () => {
  const chave = "35261067554083000131550010000123451000012345";
  const resumo = resumirDocumentoFiscal(`<resNFe><chNFe>${chave}</chNFe><xNome>Fornecedor A</xNome><dhEmi>2026-10-18T10:00:00-03:00</dhEmi><vNF>2450.00</vNF></resNFe>`, "resNFe_v1.01.xsd", chave);
  assert.deepEqual(resumo, { fornecedor: "Fornecedor A", numero: "12345", valorCentavos: 245000, emitidaEm: "2026-10-18T10:00:00-03:00", situacao: "RESUMO" });
});

test("resume NF-e completa para a lista fiscal", () => {
  const xml = `<nfeProc><NFe><infNFe><ide><nNF>987</nNF><dhEmi>2026-10-17T09:00:00-03:00</dhEmi></ide><emit><xNome>Fornecedor B</xNome></emit><total><ICMSTot><vNF>19.90</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
  assert.deepEqual(resumirDocumentoFiscal(xml, "procNFe_v4.00.xsd", null), { fornecedor: "Fornecedor B", numero: "987", valorCentavos: 1990, emitidaEm: "2026-10-17T09:00:00-03:00", situacao: "COMPLETA" });
});

test("XML inseguro não é interpretado", () => {
  assert.equal(resumirDocumentoFiscal("<!DOCTYPE x><resNFe />", "resNFe_v1.01.xsd", null).situacao, "OUTRO");
});
