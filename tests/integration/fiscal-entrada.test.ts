import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { alterarAtivoEmLote, salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { prepararEntradaFiscal, confirmarEntradaFiscal } from "../../src/lib/fiscal-entrada";

const db = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.port !== "5548" || !db.pathname.endsWith("_test")) throw new Error("QA exige PostgreSQL isolado :5548/*_test.");
const XML = readFileSync(new URL("../fixtures/nfe-entrada-qa.xml", import.meta.url), "utf8").replaceAll("<tpAmb>2</tpAmb>", "<tpAmb>1</tpAmb>");
const CHAVE = /<chNFe>(\d{44})<\/chNFe>/.exec(XML)![1];
const LOJAS: string[] = [];
after(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: LOJAS } } });
  await prisma.$disconnect();
});

async function fixture() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-nfe-${randomUUID()}`, nome: "Loja QA entrada", status: "ATIVA", cnpj: "11222333000181" } });
  LOJAS.push(tenant.id);
  const produtos = await Promise.all([1, 2].map(n => salvarProdutoNoCatalogo(tenant.id, null, { nome: `Peça QA ${n}`, slug: `peca-qa-${n}`, estoque: 5, precoCentavos: 100 })));
  const variantes = await Promise.all(produtos.map(p => prisma.variante.findFirstOrThrow({ where: { tenantId: tenant.id, produtoId: p.id } })));
  const documento = await prisma.documentoFiscalLoja.create({ data: { tenantId: tenant.id, cnpj: tenant.cnpj!, chave: CHAVE, nsu: "000000000000001", schema: "procNFe_v4.00.xsd", xml: XML } });
  const corpo = { confirmacao: true, local: "principal", itens: [{ numero: 1, varianteId: variantes[0].id, quantidade: 2 }, { numero: 2, varianteId: variantes[1].id, quantidade: 1 }] };
  return { tenant, documento, variantes, corpo };
}
const confirmar = (f: Awaited<ReturnType<typeof fixture>>, corpo: unknown = f.corpo, id = f.documento.id) => confirmarEntradaFiscal(f.tenant.id, id, corpo, "qa:dono");
const fisico = async (tenantId: string, varianteId: string) => (await prisma.saldoEstoque.findUniqueOrThrow({ where: { tenantId_varianteId_local: { tenantId, varianteId, local: "principal" } } })).fisico;

test("abrir conferência não altera estoque e confirmar duas vezes tem um único efeito", async () => {
  const f = await fixture();
  const estado = await prepararEntradaFiscal(f.tenant.id, f.documento.id);
  assert.equal(estado.nota?.itens.length, 2);
  assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 5);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: f.tenant.id } }), 0);
  const receipt = await confirmar(f);
  assert.deepEqual(await confirmar(f), receipt);
  assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 7);
  assert.equal(await fisico(f.tenant.id, f.variantes[1].id), 6);
  const lines = await prisma.razaoEstoque.findMany({ where: { tenantId: f.tenant.id, origem: "fiscal:entrada-nfe" } });
  assert.equal(lines.length, 2);
  assert.equal((await prepararEntradaFiscal(f.tenant.id, f.documento.id)).recibo?.id, receipt.id);
  await assert.rejects(() => confirmar(f, { ...f.corpo, local: "filial" }), /já|diferente|outro/i);
});

test("concorrência e XML em outro NSU da mesma chave não duplicam entrada", async () => {
  const f = await fixture();
  const duplicate = await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: f.tenant.cnpj!, chave: CHAVE, nsu: "000000000000002", schema: "procNFe_v4.00.xsd", xml: XML } });
  const [a, b] = await Promise.all([confirmar(f), confirmar(f, f.corpo, duplicate.id)]);
  assert.deepEqual(a, b);
  assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 7);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: f.tenant.id, chave: `nfe-entrada:${CHAVE}` } }), 1);
});

test("linha de outra loja é rejeitada sem aplicar nem a primeira linha", async () => {
  const f = await fixture(), other = await fixture();
  await assert.rejects(() => confirmar(f, { ...f.corpo, itens: [f.corpo.itens[0], { ...f.corpo.itens[1], varianteId: other.variantes[0].id }] }));
  assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 5);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: f.tenant.id } }), 0);
  await assert.rejects(() => prepararEntradaFiscal(other.tenant.id, f.documento.id));
  await assert.rejects(() => confirmarEntradaFiscal(other.tenant.id, f.documento.id, f.corpo, "qa:dono"));
});

test("resumo, falta de confirmação e destinatário divergente não movimentam", async () => {
  const f = await fixture();
  await assert.rejects(() => confirmar(f, { ...f.corpo, confirmacao: false }));
  await prisma.documentoFiscalLoja.update({ where: { id: f.documento.id }, data: { schema: "resNFe_v1.01.xsd", xml: "<resNFe/>" } });
  await assert.rejects(() => confirmar(f));
  await prisma.documentoFiscalLoja.update({ where: { id: f.documento.id }, data: { schema: "procNFe_v4.00.xsd", xml: XML.replace("<CNPJ>11222333000181</CNPJ>", "<CNPJ>99999999000191</CNPJ>") } });
  await assert.rejects(() => confirmar(f));
  assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 5);
});

test("cancelamento conhecido bloqueia e cancelamento posterior conserva o recibo", async () => {
  const f = await fixture();
  const event = await prisma.documentoFiscalLoja.create({ data: { tenantId: f.tenant.id, cnpj: f.tenant.cnpj!, chave: CHAVE, nsu: "000000000000003", schema: "resEvento_v1.01.xsd", xml: `<resEvento><chNFe>${CHAVE}</chNFe><tpEvento>110111</tpEvento></resEvento>` } });
  await assert.rejects(() => confirmar(f), /cancel/i);
  await prisma.documentoFiscalLoja.delete({ where: { id: event.id } });
  const receipt = await confirmar(f);
  await prisma.documentoFiscalLoja.update({ where: { id: f.documento.id }, data: { cancelada: true } });
  const state = await prepararEntradaFiscal(f.tenant.id, f.documento.id);
  assert.equal(state.recibo?.id, receipt.id);
  assert.match(state.impedimento ?? "", /cancel/i);
  assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 7);
});

test("loja integrada ao ERP conserva autoridade e não recebe entrada local", async () => {
  const f = await fixture();
  const previous = [process.env.ERP_API_URL, process.env.ERP_API_KEYS_BY_CNPJ];
  process.env.ERP_API_URL = "https://erp.example.test";
  process.env.ERP_API_KEYS_BY_CNPJ = JSON.stringify({ [f.tenant.cnpj!]: "qa-key" });
  try {
    assert.equal((await prepararEntradaFiscal(f.tenant.id, f.documento.id)).modo, "ERP");
    await assert.rejects(() => confirmar(f), /ERP/);
    assert.equal(await fisico(f.tenant.id, f.variantes[0].id), 5);
  } finally {
    for (const [i, key] of ["ERP_API_URL", "ERP_API_KEYS_BY_CNPJ"].entries()) {
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
    }
  }
});

test("falha de saldo na segunda linha desfaz a primeira escrita e todos os recibos", async () => {
  const f = await fixture();
  // Ordem efetiva de travas da entrada: a segunda linha não controla estoque.
  const ordem = [...f.variantes].sort((a, b) => a.produtoId < b.produtoId ? -1 : 1);
  await prisma.saldoEstoque.updateMany({ where: { tenantId: f.tenant.id, varianteId: ordem[1].id }, data: { fisico: null } });
  const antes = await prisma.razaoEstoque.count({ where: { tenantId: f.tenant.id } });
  await assert.rejects(() => confirmar(f), /não controla estoque/i);
  assert.equal(await fisico(f.tenant.id, ordem[0].id), 5);
  assert.equal(await fisico(f.tenant.id, ordem[1].id), null);
  assert.equal(await prisma.razaoEstoque.count({ where: { tenantId: f.tenant.id } }), antes);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: f.tenant.id } }), 0);
});

test("conferência e desativação em lote invertido conservam atomicidade sem deadlock", async () => {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const f = await fixture();
    const inversa = f.variantes.map(v => v.produtoId).sort().reverse();
    const [entrada, lote] = await Promise.allSettled([confirmar(f), alterarAtivoEmLote(f.tenant.id, inversa, false, "qa:lote")]);
    assert.equal(lote.status, "fulfilled", lote.status === "rejected" ? String(lote.reason) : "");
    if (entrada.status === "rejected") assert.match(String(entrada.reason), /ativo|inativ|encontrado/i);
    const registrada = entrada.status === "fulfilled";
    assert.equal(await fisico(f.tenant.id, f.variantes[0].id), registrada ? 7 : 5);
    assert.equal(await fisico(f.tenant.id, f.variantes[1].id), registrada ? 6 : 5);
    assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: f.tenant.id, chave: `nfe-entrada:${CHAVE}` } }), registrada ? 1 : 0);
  }
});
