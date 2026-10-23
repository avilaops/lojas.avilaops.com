import assert from "node:assert/strict";
import test from "node:test";
import { resumirDocumentoFiscal } from "./fiscal-documento";

test("resume documento resNFe para a lista fiscal", () => {
  const chave = "35261067554083000131550010000123451000012345";
  const resumo = resumirDocumentoFiscal(`<resNFe><chNFe>${chave}</chNFe><CNPJ>07309219000116</CNPJ><xNome>Fornecedor A</xNome><IE>582689633113</IE><dhEmi>2026-10-18T10:00:00-03:00</dhEmi><tpNF>1</tpNF><vNF>2450.00</vNF><dhRecbto>2026-10-18T10:02:00-03:00</dhRecbto><nProt>135264275512206</nProt><cSitNFe>1</cSitNFe><cSitConf>4</cSitConf></resNFe>`, "resNFe_v1.01.xsd", chave);
  assert.equal(resumo.tipo, "NFE");
  assert.equal(resumo.fornecedor, "Fornecedor A");
  assert.equal(resumo.documentoFornecedor, "07309219000116");
  assert.equal(resumo.inscricaoEstadual, "582689633113");
  assert.equal(resumo.numero, "12345");
  assert.equal(resumo.valorCentavos, 245000);
  assert.equal(resumo.emitidaEm, "2026-10-18T10:00:00-03:00");
  assert.equal(resumo.autorizadaEm, "2026-10-18T10:02:00-03:00");
  assert.equal(resumo.protocolo, "135264275512206");
  assert.equal(resumo.operacao, "Saída");
  assert.equal(resumo.situacaoNfe, "Uso autorizado");
  assert.equal(resumo.manifestacao, "Ciência da operação");
  assert.equal(resumo.situacao, "RESUMO");
});

test("resume NF-e completa para a lista fiscal", () => {
  const xml = `<nfeProc><NFe><infNFe><ide><nNF>987</nNF><dhEmi>2026-10-17T09:00:00-03:00</dhEmi><tpNF>0</tpNF></ide><emit><CNPJ>12345678000190</CNPJ><xNome>Fornecedor B</xNome><IE>ISENTO</IE></emit><det nItem="1"/><det nItem="2"/><total><ICMSTot><vNF>19.90</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat><dhRecbto>2026-10-17T09:01:00-03:00</dhRecbto><nProt>135000000000001</nProt></infProt></protNFe></nfeProc>`;
  const resumo = resumirDocumentoFiscal(xml, "procNFe_v4.00.xsd", null);
  assert.equal(resumo.tipo, "NFE");
  assert.equal(resumo.fornecedor, "Fornecedor B");
  assert.equal(resumo.numero, "987");
  assert.equal(resumo.valorCentavos, 1990);
  assert.equal(resumo.operacao, "Entrada");
  assert.equal(resumo.quantidadeItens, 2);
  assert.equal(resumo.situacaoNfe, "Uso autorizado");
  assert.equal(resumo.situacao, "COMPLETA");
});

test("resume resEvento e processo de evento para a linha do tempo", () => {
  const chave = "35261067554083000131550010000123451000012345";
  const resumo = resumirDocumentoFiscal(`<resEvento><CNPJ>67554083000131</CNPJ><chNFe>${chave}</chNFe><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><xEvento>Ciência da Operação</xEvento><dhRecbto>2026-10-18T11:00:00-03:00</dhRecbto><nProt>135000000000002</nProt></resEvento>`, "resEvento_v1.01.xsd", chave);
  assert.equal(resumo.tipo, "EVENTO");
  assert.equal(resumo.numero, "12345");
  assert.equal(resumo.eventoCodigo, "210210");
  assert.equal(resumo.eventoDescricao, "Ciência da Operação");
  assert.equal(resumo.eventoSequencia, 1);
  assert.equal(resumo.eventoRegistradoEm, "2026-10-18T11:00:00-03:00");
  assert.equal(resumo.protocolo, "135000000000002");
  assert.equal(resumo.situacao, "EVENTO");

  const processo = resumirDocumentoFiscal(`<procEventoNFe><evento><infEvento><CNPJ>67554083000131</CNPJ><chNFe>${chave}</chNFe><dhEvento>2026-10-18T10:59:00-03:00</dhEvento><tpEvento>210200</tpEvento><nSeqEvento>1</nSeqEvento><detEvento><descEvento>Confirmação da Operação</descEvento></detEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><dhRegEvento>2026-10-18T11:00:00-03:00</dhRegEvento><nProt>135000000000003</nProt></infEvento></retEvento></procEventoNFe>`, "procEventoNFe_v1.00.xsd", chave);
  assert.equal(processo.eventoDescricao, "Confirmação da Operação");
  assert.equal(processo.eventoStatus, "135");
  assert.equal(processo.eventoMotivo, "Evento registrado e vinculado a NF-e");
  assert.equal(processo.protocolo, "135000000000003");
});

test("XML inseguro não é interpretado", () => {
  assert.equal(resumirDocumentoFiscal("<!DOCTYPE x><resNFe />", "resNFe_v1.01.xsd", null).situacao, "OUTRO");
});
