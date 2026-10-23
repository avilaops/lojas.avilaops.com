import assert from "node:assert/strict";
import test from "node:test";
import { ConfigurarFluxoFiscal, dadosParaFluxoFiscal } from "./fiscal-fluxos-contrato";
import { filtrosFiscais } from "./fiscal-filtros";

const base = { id: "doc", cnpj: "12345678000190", nsu: "000000000000001", chave: "1".repeat(44), recebidoEm: new Date("2026-10-18T20:00:00Z") };
const completa = { ...base, schema: "procNFe_v4.00.xsd", xml: `<nfeProc><NFe><infNFe><ide><nNF>123</nNF></ide><emit><CNPJ>11222333000144</CNPJ><xNome>Fornecedor</xNome></emit><det nItem="1"><prod><cProd>ABC</cProd><xProd>Peça</xProd><qCom>1.5000</qCom><vUnCom>12.123400</vUnCom><vProd>18.19</vProd></prod></det><total><ICMSTot><vNF>18.19</vNF></ICMSTot></total></infNFe></NFe></nfeProc>` };

test("projeção seleciona dados e preserva precisão de quantidade e preço unitário", () => {
  const r = dadosParaFluxoFiscal(completa, ["itens", "totais"]);
  assert.equal(r?.tipo, "fiscal.nfe-recebida");
  assert.equal(r?.dados.totais?.valorCentavos, 1819);
  assert.equal(r?.dados.itens?.[0].quantidade, "1.5000");
  assert.equal(r?.dados.itens?.[0].valorUnitario, "12.123400");
  assert.equal(r?.dados.itens?.[0].totalCentavos, 1819);
  assert.equal(r?.dados.fornecedor, undefined);
  assert.equal(JSON.stringify(r).includes("<nfeProc>"), false);
});

test("resumo não promete itens e campos ausentes não viram zero", () => {
  const r = dadosParaFluxoFiscal({ ...base, schema: "resNFe.xsd", xml: "<resNFe><xNome>Resumo</xNome></resNFe>" }, ["itens", "totais"]);
  assert.equal(r?.tipo, "fiscal.nfe-resumo");
  assert.equal(r?.dados.itensDisponiveis, false);
  assert.deepEqual(r?.dados.itens, []);
  assert.equal(r?.dados.totais?.valorCentavos, null);
});

test("evento fiscal preserva tipo, sequência e protocolo e não se apresenta como NF-e completa", () => {
  const r = dadosParaFluxoFiscal({ ...base, schema: "procEventoNFe_v1.00.xsd", xml: `<procEventoNFe><evento><infEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><detEvento><descEvento>Cancelamento</descEvento></detEvento></infEvento></evento><retEvento><infEvento><nProt>123456</nProt></infEvento></retEvento></procEventoNFe>` }, ["evento"]);
  assert.equal(r?.tipo, "fiscal.evento-recebido");
  assert.equal(r?.dados.evento?.tipo, "110111");
  assert.equal(r?.dados.evento?.protocolo, "123456");
  assert.equal(r?.dados.itens, undefined);
});

test("XML inválido, DTD, entidade e formato desconhecido não produzem fluxo", () => {
  for (const xml of ["<!DOCTYPE x><resNFe/>", "<!ENTITY x SYSTEM 'file:///etc/passwd'><resNFe/>", "<resNFe>", "<outro/>"]) {
    assert.equal(dadosParaFluxoFiscal({ ...base, schema: "resNFe.xsd", xml }, ["fornecedor"]), null);
  }
});

test("regra exige evento e campos válidos e bloqueia produto sem XML completo", () => {
  const regra = { nome: "Conferir", webhookId: "destino", finalidade: "compras", eventos: ["fiscal.nfe-recebida"], campos: ["totais"] };
  assert.equal(ConfigurarFluxoFiscal.safeParse(regra).success, true);
  for (const invalida of [{ ...regra, campos: ["certificadoEnc"] }, { ...regra, campos: [] }, { ...regra, eventos: [] }, { ...regra, tenantId: "outra" }, { ...regra, finalidade: "produtos", eventos: ["fiscal.nfe-resumo"] }]) {
    assert.equal(ConfigurarFluxoFiscal.safeParse(invalida).success, false);
  }
});

test("busca e período nunca removem escopo e paginação tem limites", () => {
  const f = filtrosFiscais("minha-loja", new URLSearchParams({ busca: "Fornecedor", tipo: "completa", inicio: "2026-10-18", fim: "2026-10-18", pagina: "Infinity" }));
  assert.equal(f.where.tenantId, "minha-loja");
  assert.equal(f.pagina, 1);
  assert.deepEqual(f.where.recebidoEm, { gte: new Date("2026-10-18T03:00:00Z"), lt: new Date("2026-10-19T03:00:00Z") });
  assert.equal(filtrosFiscais("x", new URLSearchParams({ pagina: "-10" })).pagina, 1);
});
