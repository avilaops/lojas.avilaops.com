import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { cifrar } from "../../src/lib/cofre";
import { enfileirarFluxosFiscais } from "../../src/lib/fiscal-fluxos";
import { entregarWebhooks } from "../../src/lib/webhooks-entrega";
import { conferirAssinatura } from "../../src/lib/webhooks-api";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["5548", "5588"].includes(url.port) || !url.pathname.endsWith("_test")) throw new Error("Teste exige Postgres local isolado :5548 ou :5588 e base *_test.");
process.env.LOJAS_SECRET ??= "0".repeat(64);
const lojas: string[] = [];
after(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: lojas } } });
  await prisma.$disconnect();
});
async function preparar() {
  const loja = await prisma.tenant.create({ data: { slug: `fiscal-fluxo-${randomUUID()}`, nome: "QA fiscal fluxos", plano: "LOJA_PRO", status: "ATIVA" } });
  lojas.push(loja.id);
  const webhook = await prisma.webhookApi.create({ data: { tenantId: loja.id, nome: "n8n já conectado", url: "https://n8n.example/webhook/fiscal", segredoEnc: cifrar("segredo-teste"), eventos: ["pedido.pago"] } });
  const fluxo = await prisma.fluxoFiscalLoja.create({ data: { tenantId: loja.id, webhookId: webhook.id, nome: "Conferir fornecedor", finalidade: "fornecedores", eventos: ["fiscal.nfe-resumo"], campos: ["fornecedor"], criadoPor: "dono@example.test" } });
  const doc = await prisma.documentoFiscalLoja.create({ data: { tenantId: loja.id, cnpj: "12345678000190", nsu: "000000000000001", schema: "resNFe.xsd", xml: "<resNFe><xNome>Fornecedor QA</xNome><CNPJ>11222333000144</CNPJ><vNF>19.90</vNF></resNFe>" } });
  return { loja, webhook, fluxo, doc };
}
test("fila fiscal usa destino existente, entrega assinada e dados selecionados com controle de revisão", async () => {
  const { loja, webhook, fluxo, doc } = await preparar();
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, loja.id, [doc])), 1);
  const entrega = await prisma.entregaWebhook.findFirstOrThrow({ where: { tenantId: loja.id } });
  assert.equal(entrega.webhookId, webhook.id);
  const corpo = entrega.corpo as Record<string, unknown>;
  assert.equal(corpo.correlationId, `fiscal:${doc.id}`);
  assert.deepEqual(corpo.controle, { modo: "REVISAO", exigeConfirmacaoFinanceira: true, exigeConfirmacaoEstoque: true, exigeConfirmacaoProdutos: true });
  const dados = corpo.dados as Record<string, unknown>;
  assert.equal(dados.totais, undefined);
  assert.equal(dados.itens, undefined);
  assert.equal(JSON.stringify(corpo).includes(doc.xml), false);
  assert.equal((corpo.fluxo as { id: string }).id, fluxo.id);
  let assinada = false;
  await entregarWebhooks({ enviar: async (_url, texto, headers) => {
    if (headers["x-lojas-entrega"] === entrega.id) assinada = conferirAssinatura("segredo-teste", texto, headers["x-lojas-assinatura"]);
    return { status: 204 };
  } });
  assert.equal(assinada, true);
  assert.equal((await prisma.entregaWebhook.findUniqueOrThrow({ where: { id: entrega.id } })).status, "ENTREGUE");
});
test("cliques concorrentes e retenção da fila não reencaminham o mesmo documento", async () => {
  const { loja, doc } = await preparar();
  const resultados = await Promise.all([1, 2, 3].map(() => prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, loja.id, [doc]))));
  assert.equal(resultados.reduce((s, n) => s + n, 0), 1);
  await prisma.entregaWebhook.deleteMany({ where: { tenantId: loja.id } });
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, loja.id, [doc])), 0);
});
test("lojas, documentos, destino, evento e fluxo desativados respeitam isolamento e assinatura", async () => {
  const a = await preparar(); const b = await preparar();
  await assert.rejects(prisma.fluxoFiscalLoja.create({ data: { tenantId: a.loja.id, webhookId: b.webhook.id, nome: "Cruzado", finalidade: "compras", eventos: ["fiscal.nfe-resumo"], campos: ["fornecedor"], criadoPor: "DONO" } }), { code: "P2003" });
  await assert.rejects(prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, b.loja.id, [a.doc])), /outra loja/);
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, a.loja.id, [a.doc], { fluxoId: b.fluxo.id })), 0);
  await prisma.fluxoFiscalLoja.update({ where: { id: a.fluxo.id }, data: { ativo: false } });
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, a.loja.id, [a.doc])), 0);
  await prisma.fluxoFiscalLoja.update({ where: { id: a.fluxo.id }, data: { ativo: true, eventos: ["fiscal.nfe-recebida"] } });
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, a.loja.id, [a.doc])), 0);
  await prisma.fluxoFiscalLoja.update({ where: { id: a.fluxo.id }, data: { eventos: ["fiscal.nfe-resumo"] } });
  await prisma.webhookApi.update({ where: { id: a.webhook.id }, data: { ativo: false } });
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, a.loja.id, [a.doc])), 0);
  assert.equal(await prisma.entregaWebhook.count({ where: { tenantId: { in: [a.loja.id, b.loja.id] } } }), 0);
});
test("regras duplicadas são recusadas e falha na fila reverte o marcador do documento", async () => {
  const { loja, fluxo, doc } = await preparar();
  await assert.rejects(prisma.fluxoFiscalLoja.create({ data: { tenantId: loja.id, webhookId: fluxo.webhookId, nome: "Duplicado", finalidade: fluxo.finalidade, eventos: fluxo.eventos, campos: fluxo.campos, criadoPor: "DONO" } }), { code: "P2002" });
  await assert.rejects(prisma.$transaction(async (tx) => {
    await enfileirarFluxosFiscais(tx, loja.id, [doc]);
    throw new Error("falha no cursor");
  }), /falha no cursor/);
  assert.deepEqual((await prisma.documentoFiscalLoja.findUniqueOrThrow({ where: { id: doc.id } })).fluxosEnfileirados, []);
  assert.equal(await prisma.entregaWebhook.count({ where: { tenantId: loja.id } }), 0);
  assert.equal(await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, loja.id, [doc])), 1);
});
test("falha de transporte mantém mesma identidade e corpo na nova tentativa", async () => {
  const { loja, doc } = await preparar();
  await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, loja.id, [doc]));
  const antes = await prisma.entregaWebhook.findFirstOrThrow({ where: { tenantId: loja.id } });
  await entregarWebhooks({ enviar: async () => ({ status: 503 }) });
  const depois = await prisma.entregaWebhook.findUniqueOrThrow({ where: { id: antes.id } });
  assert.equal(depois.status, "PENDENTE"); assert.equal(depois.tentativas, 1);
  assert.equal(depois.eventId, antes.eventId); assert.deepEqual(depois.corpo, antes.corpo);
});
