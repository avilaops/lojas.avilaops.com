import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { consultarAcompanhamentoFiscal } from "../../src/lib/fiscal-acompanhamento";
import { reconciliarManifestacoesFiscais } from "../../src/lib/fiscal-manifestacao-conciliacao";
import { confirmarEntradaFiscal } from "../../src/lib/fiscal-entrada";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";

const db = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.port !== "5548" || !db.pathname.endsWith("_test")) throw new Error("QA exige PostgreSQL isolado :5548/*_test.");
const XML = readFileSync(new URL("../fixtures/nfe-entrada-qa.xml", import.meta.url), "utf8").replaceAll("<tpAmb>2</tpAmb>", "<tpAmb>1</tpAmb>");
const CHAVE = /<chNFe>(\d{44})<\/chNFe>/.exec(XML)![1];
const CNPJ = "11222333000181";
const LOJAS: string[] = [];
after(async () => {
  await prisma.auditoriaFiscalLoja.deleteMany({ where: { tenantId: { in: LOJAS } } });
  await prisma.manifestacaoFiscalLoja.deleteMany({ where: { tenantId: { in: LOJAS } } });
  await prisma.tenant.deleteMany({ where: { id: { in: LOJAS } } });
  await prisma.$disconnect();
});
async function fixture() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-acomp-${randomUUID()}`, nome: "QA acompanhamento", status: "ATIVA", cnpj: CNPJ } });
  LOJAS.push(tenant.id);
  const documento = await prisma.documentoFiscalLoja.create({ data: { tenantId: tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000001", schema: "resNFe_v1.01.xsd", xml: `<resNFe><chNFe>${CHAVE}</chNFe></resNFe>` } });
  return { tenant, documento };
}
async function intencao(f: Awaited<ReturnType<typeof fixture>>) {
  return prisma.manifestacaoFiscalLoja.create({ data: { tenantId: f.tenant.id, documentoId: f.documento.id, idempotencia: `NFE:${CHAVE}:210210:1:PRODUCAO`, tipo: "CIENCIA", autor: "qa:dono", ambiente: "PRODUCAO", sequencia: 1, status: "PENDENTE_CONFERENCIA", enviadoEm: new Date(), proximaTentativaEm: new Date(0) } });
}
const evento = (cnpj = CNPJ, ambiente = "1", sequencia = "1", chave = CHAVE) => `<procEventoNFe><evento><infEvento><tpAmb>${ambiente}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><tpEvento>210210</tpEvento><nSeqEvento>${sequencia}</nSeqEvento></infEvento></evento><retEvento><infEvento><tpAmb>${ambiente}</tpAmb><chNFe>${chave}</chNFe><tpEvento>210210</tpEvento><nSeqEvento>${sequencia}</nSeqEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><nProt>135260000099999</nProt></infEvento></retEvento></procEventoNFe>`;

test("acompanhamento encontra XML completo em outro NSU sem produzir efeitos", async () => {
  const f = await fixture();
  const antes = await consultarAcompanhamentoFiscal(f.tenant.id, [CHAVE]);
  assert.equal(antes.get(CHAVE)?.estado, "AGUARDANDO_MANIFESTACAO");
  const completo = await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000002", schema: "procNFe_v4.00.xsd", xml: XML } });
  const depois = await consultarAcompanhamentoFiscal(f.tenant.id, [CHAVE]);
  assert.equal(depois.get(CHAVE)?.estado, "PRONTA");
  assert.equal(depois.get(CHAVE)?.completoId, completo.id);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: f.tenant.id } }), 0);
});

test("recibo e cancelamento posterior acompanham a chave e respeitam tenant", async () => {
  const f = await fixture(), outra = await fixture();
  const completo = await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000002", schema: "procNFe_v4.00.xsd", xml: XML } });
  const produtos = await Promise.all([1, 2].map(n => salvarProdutoNoCatalogo(f.tenant.id, null, { nome: `QA ${n}`, slug: `qa-${n}`, estoque: 3, precoCentavos: 100 })));
  const variantes = await Promise.all(produtos.map(p => prisma.variante.findFirstOrThrow({ where: { tenantId: f.tenant.id, produtoId: p.id } })));
  const recibo = await confirmarEntradaFiscal(f.tenant.id, completo.id, { confirmacao: true, local: "principal", itens: variantes.map((v, i) => ({ numero: i + 1, varianteId: v.id, quantidade: 1 })) }, "qa:dono");
  const recebida = (await consultarAcompanhamentoFiscal(f.tenant.id, [CHAVE])).get(CHAVE)!;
  assert.equal(recebida.estado, "ENTRADA_REGISTRADA");
  assert.equal(recebida.recibo?.id, recibo.id);
  assert.equal(recebida.recibo?.local, "principal");
  assert.equal((await consultarAcompanhamentoFiscal(outra.tenant.id, [CHAVE])).get(CHAVE)?.recibo, null);
  await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000003", schema: "resEvento_v1.01.xsd", xml: `<resEvento><chNFe>${CHAVE}</chNFe><tpEvento>110111</tpEvento></resEvento>` } });
  const cancelada = (await consultarAcompanhamentoFiscal(f.tenant.id, [CHAVE])).get(CHAVE)!;
  assert.equal(cancelada.estado, "REVISAO_NECESSARIA");
  assert.equal(cancelada.recibo?.id, recibo.id);
  assert.equal(await prisma.razaoEstoque.count({ where: { tenantId: f.tenant.id, origem: "fiscal:entrada-nfe" } }), 2);
});

test("resultado incerto só é conciliado com evento completo da mesma intenção", async () => {
  const f = await fixture();
  const registro = await intencao(f);
  for (const [i, xml] of [evento("99999999000191"), evento(CNPJ, "2"), evento(CNPJ, "1", "2"), evento(CNPJ, "1", "1", "9".repeat(44)), evento().replace("<tpEvento>210210</tpEvento>", "<tpEvento>210200</tpEvento>"), evento().replace("<nProt>135260000099999</nProt>", ""), `<!DOCTYPE x>${evento()}`].entries()) {
    await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: String(10 + i).padStart(15, "0"), schema: "procEventoNFe_v1.00.xsd", xml } });
  }
  await reconciliarManifestacoesFiscais(prisma, f.tenant.id);
  assert.equal((await prisma.manifestacaoFiscalLoja.findUniqueOrThrow({ where: { id: registro.id } })).status, "PENDENTE_CONFERENCIA");
  assert.equal((await consultarAcompanhamentoFiscal(f.tenant.id, [CHAVE])).get(CHAVE)?.estado, "AGUARDANDO_RESULTADO");
  await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000099", schema: "procEventoNFe_v1.00.xsd", xml: evento() } });
  await reconciliarManifestacoesFiscais(prisma, f.tenant.id);
  await reconciliarManifestacoesFiscais(prisma, f.tenant.id);
  const final = await prisma.manifestacaoFiscalLoja.findUniqueOrThrow({ where: { id: registro.id } });
  assert.equal(final.status, "ACEITA");
  assert.equal(final.protocolo, "135260000099999");
  assert.equal(final.tentativas, 0, "conciliar nunca retransmite evento");
  assert.equal((await consultarAcompanhamentoFiscal(f.tenant.id, [CHAVE])).get(CHAVE)?.estado, "AGUARDANDO_XML");
  assert.equal(await prisma.auditoriaFiscalLoja.count({ where: { tenantId: f.tenant.id, acao: "MANIFESTACAO_CONCILIADA" } }), 1);
});

test("evento de outra loja e resumo sem protocolo não confirmam manifestação", async () => {
  const f = await fixture(), outra = await fixture();
  const registro = await intencao(f);
  await prisma.documentoFiscalLoja.create({ data: { tenantId: outra.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000002", schema: "procEventoNFe_v1.00.xsd", xml: evento() } });
  await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: CNPJ, chave: CHAVE, nsu: "000000000000003", schema: "resEvento_v1.01.xsd", xml: `<resEvento><chNFe>${CHAVE}</chNFe><tpEvento>210210</tpEvento></resEvento>` } });
  await reconciliarManifestacoesFiscais(prisma, f.tenant.id);
  assert.equal((await prisma.manifestacaoFiscalLoja.findUniqueOrThrow({ where: { id: registro.id } })).status, "PENDENTE_CONFERENCIA");
});
