import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import forge from "node-forge";
import { prisma } from "../../src/lib/db";
import { selarCertificado } from "../../src/lib/fiscal-certificado";
import { sincronizarNotas } from "../../src/lib/fiscal-loja";
import { responderDownloadXmlFiscal } from "../../src/lib/fiscal-download";
import { cifrar } from "../../src/lib/cofre";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["5548", "5588"].includes(url.port) || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige Postgres local isolado :5548 ou :5588 e base *_test.");
}
process.env.LOJAS_CERT_SECRET = "cd".repeat(32);
const lojas: string[] = [];
after(async () => {
  await prisma.webhookApi.deleteMany({ where: { tenantId: { in: lojas } } });
  await prisma.documentoFiscalLoja.deleteMany({ where: { tenantId: { in: lojas } } });
  await prisma.fiscalLoja.deleteMany({ where: { tenantId: { in: lojas } } });
  await prisma.tenant.deleteMany({ where: { id: { in: lojas } } });
  await prisma.$disconnect();
});

async function preparar(cnpj: string) {
  const loja = await prisma.tenant.create({ data: { slug: `fiscal-${randomUUID()}`, nome: "Fiscal QA", cnpj, status: "ATIVA" } });
  lojas.push(loja.id);
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey; cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: "commonName", value: `FISCAL QA:${cnpj}` }]);
  cert.setIssuer(cert.subject.attributes); cert.sign(chaves.privateKey, forge.md.sha256.create());
  const pfx = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(chaves.privateKey, cert, "teste", { algorithm: "3des" })).getBytes(), "binary");
  await prisma.fiscalLoja.create({ data: {
    tenantId: loja.id, cnpj, uf: "SP", titular: "Fiscal QA", validoAte: cert.validity.notAfter,
    certificadoEnc: selarCertificado(pfx, "teste"), proximaConsultaEm: new Date(0),
  } });
  return loja;
}

test("duas consultas concorrentes produzem uma chamada e preservam isolamento", async () => {
  const a = await preparar("12345678000190");
  const b = await preparar("12345678000270");
  let liberar!: () => void;
  let entrar!: () => void;
  const entrou = new Promise<void>((r) => { entrar = r; });
  const espera = new Promise<void>((r) => { liberar = r; });
  let chamadas = 0;
  const primeira = sincronizarNotas(a.id, async (_pfx, _senha, cnpj, _uf, nsu) => {
    chamadas++; assert.equal(cnpj, a.cnpj); assert.equal(nsu, "000000000000000"); entrar(); await espera;
    return { status: "138", mensagem: "Lote", ultimoNsu: "000000000000001", maxNsu: "000000000000002", documentos: [
      { nsu: "000000000000001", schema: "resNFe_v1.01.xsd", chave: null, xml: "<resNFe/>" },
    ] };
  });
  await entrou;
  await assert.rejects(() => sincronizarNotas(a.id, async () => { throw new Error("Não deveria consultar"); }), /intervalo/);
  liberar(); await primeira;
  assert.equal(chamadas, 1);
  assert.equal((await prisma.fiscalLoja.findUniqueOrThrow({ where: { tenantId: a.id } })).ultimoNsu, "000000000000001");
  assert.equal(await prisma.documentoFiscalLoja.count({ where: { tenantId: a.id } }), 1);
  assert.equal(await prisma.documentoFiscalLoja.count({ where: { tenantId: b.id } }), 0);
  const doc = await prisma.documentoFiscalLoja.findFirstOrThrow({ where: { tenantId: a.id } });
  assert.equal(await prisma.documentoFiscalLoja.findFirst({ where: { id: doc.id, tenantId: b.id } }), null);
  const dados = { tenantId: a.id, cnpj: a.cnpj!, nsu: doc.nsu, schema: doc.schema, xml: doc.xml };
  assert.equal((await prisma.documentoFiscalLoja.createMany({ data: [dados], skipDuplicates: true })).count, 0);
});

test("download XML exige documento completo e mantém isolamento por tenant", async () => {
  const a = await preparar("13345678000190");
  const b = await preparar("13345678000270");
  const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${"1".repeat(44)}"><ide><mod>55</mod></ide></infNFe></NFe><protNFe><infProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
  const completo = await prisma.documentoFiscalLoja.create({ data: {
    tenantId: a.id, cnpj: a.cnpj!, nsu: "000000000000001", schema: "procNFe_v4.00.xsd", chave: "1".repeat(44), xml,
  } });
  const resumo = await prisma.documentoFiscalLoja.create({ data: {
    tenantId: a.id, cnpj: a.cnpj!, nsu: "000000000000002", schema: "resNFe_v1.01.xsd", chave: "2".repeat(44), xml: `<resNFe><chNFe>${"2".repeat(44)}</chNFe></resNFe>`,
  } });

  const autorizado = await responderDownloadXmlFiscal(a.id, completo.id);
  assert.equal(autorizado.status, 200);
  assert.equal(await autorizado.text(), xml);
  assert.equal((await responderDownloadXmlFiscal(b.id, completo.id)).status, 404);
  assert.equal((await responderDownloadXmlFiscal(a.id, resumo.id)).status, 409);
});

test("falha de transporte preserva NSU e aguarda uma hora a partir da falha", async () => {
  const loja = await preparar("22345678000190");
  const inicio = Date.now();
  await assert.rejects(() => sincronizarNotas(loja.id, async () => { throw new Error("Falha simulada"); }), /Não foi possível/);
  const fiscal = await prisma.fiscalLoja.findUniqueOrThrow({ where: { tenantId: loja.id } });
  assert.equal(fiscal.ultimoNsu, "000000000000000");
  assert.ok(fiscal.proximaConsultaEm.getTime() >= inicio + 3_600_000);
  assert.equal(await prisma.documentoFiscalLoja.count({ where: { tenantId: loja.id } }), 0);
});

test("consumo indevido e fim da fila não provocam nova consulta imediata", async () => {
  const loja = await preparar("32345678000190");
  const consumoIndevido = await sincronizarNotas(loja.id, async () => ({ status: "656", mensagem: "Aguardar", ultimoNsu: "000000000000005", maxNsu: "000000000000005", documentos: [] }));
  assert.equal(consumoIndevido.cursorAjustado, true);
  assert.equal((await prisma.fiscalLoja.findUniqueOrThrow({ where: { tenantId: loja.id } })).ultimoNsu, "000000000000005");
  await assert.rejects(() => sincronizarNotas(loja.id), /intervalo/);

  await prisma.fiscalLoja.update({ where: { tenantId: loja.id }, data: { proximaConsultaEm: new Date(0) } });
  await sincronizarNotas(loja.id, async () => ({ status: "137", mensagem: "Fim da fila", ultimoNsu: "000000000000005", maxNsu: "000000000000005", documentos: [] }));
  await assert.rejects(() => sincronizarNotas(loja.id), /intervalo/);
});

test("falha ao gravar o lote reverte documentos e NSU juntos", async () => {
  const loja = await preparar("42345678000190");
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_fiscal_recusar_cursor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."cnpj" = '42345678000190' AND NEW."ultimoNsu" <> OLD."ultimoNsu" THEN RAISE EXCEPTION 'Falha de armazenamento simulada'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_fiscal_cursor BEFORE UPDATE ON "FiscalLoja" FOR EACH ROW EXECUTE FUNCTION qa_fiscal_recusar_cursor()`);
  try {
    await assert.rejects(() => sincronizarNotas(loja.id, async () => ({
      status: "138", mensagem: "Lote", ultimoNsu: "000000000000001", maxNsu: "000000000000001",
      documentos: [{ nsu: "000000000000001", schema: "resNFe.xsd", chave: null, xml: "<resNFe/>" }],
    })));
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER qa_fiscal_cursor ON "FiscalLoja"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION qa_fiscal_recusar_cursor()`);
  }
  assert.equal((await prisma.fiscalLoja.findUniqueOrThrow({ where: { tenantId: loja.id } })).ultimoNsu, "000000000000000");
  assert.equal(await prisma.documentoFiscalLoja.count({ where: { tenantId: loja.id } }), 0);
});

test("mudança de CNPJ bloqueia consulta sem chamar a SEFAZ", async () => {
  const loja = await preparar("52345678000190");
  await prisma.tenant.update({ where: { id: loja.id }, data: { cnpj: "52345678000270" } });
  let chamado = false;
  await assert.rejects(() => sincronizarNotas(loja.id, async () => { chamado = true; throw new Error(); }), /CNPJ da loja mudou/);
  assert.equal(chamado, false);
});

test("consulta enfileira somente novos documentos e falha do cursor também reverte a entrega", async () => {
  process.env.LOJAS_SECRET ??= "0".repeat(64);
  const loja = await preparar("62345678000190");
  await prisma.tenant.update({ where: { id: loja.id }, data: { plano: "LOJA_PRO" } });
  const webhook = await prisma.webhookApi.create({ data: { tenantId: loja.id, nome: "Fiscal QA", url: "https://n8n.example/webhook/fiscal", eventos: [], segredoEnc: cifrar("teste") } });
  await prisma.fluxoFiscalLoja.create({ data: { tenantId: loja.id, webhookId: webhook.id, nome: "Revisão QA", finalidade: "compras", eventos: ["fiscal.nfe-resumo"], campos: ["totais"], criadoPor: "DONO" } });
  const doc = { nsu: "000000000000001", schema: "resNFe.xsd", chave: null, xml: "<resNFe><vNF>19.90</vNF></resNFe>" };
  const consultar = async () => ({ status: "138", mensagem: "Lote", ultimoNsu: "000000000000001", maxNsu: "000000000000001", documentos: [doc] });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_fiscal_fluxos_recusar() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."cnpj" = '62345678000190' AND NEW."ultimoNsu" <> OLD."ultimoNsu" THEN RAISE EXCEPTION 'Falha fiscal simulada'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_fiscal_fluxos_cursor BEFORE UPDATE ON "FiscalLoja" FOR EACH ROW EXECUTE FUNCTION qa_fiscal_fluxos_recusar()`);
  try { await assert.rejects(() => sincronizarNotas(loja.id, consultar)); }
  finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER qa_fiscal_fluxos_cursor ON "FiscalLoja"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION qa_fiscal_fluxos_recusar()`);
  }
  assert.equal(await prisma.documentoFiscalLoja.count({ where: { tenantId: loja.id } }), 0);
  assert.equal(await prisma.entregaWebhook.count({ where: { tenantId: loja.id } }), 0);
  assert.equal((await prisma.fiscalLoja.findUniqueOrThrow({ where: { tenantId: loja.id } })).ultimoNsu, "000000000000000");
  await prisma.fiscalLoja.update({ where: { tenantId: loja.id }, data: { proximaConsultaEm: new Date(0) } });
  const recebido = await sincronizarNotas(loja.id, consultar);
  assert.equal(recebido.recebidos, 1); assert.equal(recebido.enfileirados, 1);
  await prisma.fiscalLoja.update({ where: { tenantId: loja.id }, data: { proximaConsultaEm: new Date(0) } });
  const repetido = await sincronizarNotas(loja.id, async () => ({ ...await consultar(), ultimoNsu: "000000000000002", maxNsu: "000000000000002" }));
  assert.equal(repetido.recebidos, 0); assert.equal(repetido.enfileirados, 0);
  assert.equal(await prisma.entregaWebhook.count({ where: { tenantId: loja.id } }), 1);
});
