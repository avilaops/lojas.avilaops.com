import assert from "node:assert/strict";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { emitirToken } from "../src/lib/sessao";
import { cifrar } from "../src/lib/cofre";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const db = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!['5548', '5588'].includes(db.port) || db.hostname !== "127.0.0.1" || !db.pathname.endsWith("_test")) throw new Error("QA exige banco local isolado :5548/:5588/*_test.");
const base = process.env.QA_BASE_URL ?? "http://localhost:3088";
if (new URL(base).hostname !== "localhost") throw new Error("QA exige aplicação local localhost.");
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } : {}) });
const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
type Fixture = { slug: string; outraSlug: string; operadorId: string; documentoId: string; outroDocumentoId: string; webhookId: string };
const fixtureExterna = process.env.QA_FISCAL_FIXTURE;
async function preparar(): Promise<Fixture> {
  const loja = await prisma.tenant.create({ data: { slug: `qa-fiscal-${randomUUID()}`, nome: "QA Fluxos", status: "ATIVA", plano: "LOJA_PRO", endereco: { uf: "SP" } } });
  const outra = await prisma.tenant.create({ data: { slug: `qa-fiscal-${randomUUID()}`, nome: "Outra loja QA", status: "ATIVA" } });
  const op = await prisma.operadorLoja.create({ data: { tenantId: loja.id, nome: "Gerente QA", email: "gerente@example.test", senhaHash: "qa", papel: "GERENTE" } });
  const webhook = await prisma.webhookApi.create({ data: { tenantId: loja.id, nome: "n8n existente QA", url: "https://n8n.example/webhook/qa", segredoEnc: cifrar("segredo-qa"), eventos: ["pedido.pago"] } });
  const doc = await prisma.documentoFiscalLoja.create({ data: { tenantId: loja.id, cnpj: "12345678000190", nsu: "000000000000001", schema: "procNFe_v4.00.xsd", chave: "1".repeat(44), xml: "<nfeProc><NFe><infNFe><ide><nNF>42</nNF></ide><emit><xNome>Fornecedor QA</xNome></emit><total><ICMSTot><vNF>19.90</vNF></ICMSTot></total></infNFe></NFe></nfeProc>" } });
  const outroDoc = await prisma.documentoFiscalLoja.create({ data: { tenantId: outra.id, cnpj: "12345678000270", nsu: "000000000000001", schema: "resNFe.xsd", xml: "<resNFe/>" } });
  await prisma.$disconnect();
  return { slug: loja.slug, outraSlug: outra.slug, operadorId: op.id, documentoId: doc.id, outroDocumentoId: outroDoc.id, webhookId: webhook.id };
}
const fixture = fixtureExterna ? JSON.parse(fixtureExterna) as Fixture : await preparar();
await contexto.addCookies([{ name: "lojas_sessao", value: emitirToken(fixture.slug), url: base }]);
const page = await contexto.newPage();
page.setDefaultTimeout(20000);
const erros: string[] = [];
page.on("pageerror", (e) => erros.push(e.message));
const origem = { Origin: base };
try {
  await page.goto(`${base}/painel/configuracoes/fiscal`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("heading", { name: "Fluxos com dados fiscais" }).waitFor();
  console.log("Monitor fiscal carregado.");
  await page.getByText("Configurar fluxo fiscal", { exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Conferência de compras QA");
  await page.getByLabel("Destino conectado").selectOption(fixture.webhookId);
  await page.getByRole("button", { name: "Salvar fluxo", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Configuração salva" }).waitFor();
  const regras = await (await contexto.request.get(`${base}/api/painel/fiscal/fluxos`)).json();
  assert.equal(regras.fluxos.length, 1);
  const fluxoId = regras.fluxos[0].id as string;
  const semOrigem = await contexto.request.patch(`${base}/api/painel/fiscal/fluxos`, { data: { id: fluxoId, ativo: false } });
  assert.equal(semOrigem.status(), 403);
  const cruzado = await contexto.request.post(`${base}/api/painel/fiscal/documentos/${fixture.outroDocumentoId}/fluxos`, { headers: origem, data: { fluxoId } });
  assert.equal(cruzado.status(), 404);
  const semSessao = await browser.newContext();
  assert.equal((await semSessao.request.get(`${base}/api/painel/fiscal/fluxos`)).status(), 401);
  await semSessao.close();
  const gerente = await browser.newContext();
  await gerente.addCookies([{ name: "lojas_sessao", value: emitirToken(fixture.slug, fixture.operadorId), url: base }]);
  for (const path of ["/api/painel/fiscal/fluxos", "/api/painel/fiscal"]) assert.equal((await gerente.request.get(base + path)).status(), 403);
  assert.equal((await gerente.request.post(`${base}/api/painel/fiscal/documentos/${fixture.documentoId}/fluxos`, { headers: origem, data: { fluxoId } })).status(), 403);
  assert.equal((await gerente.request.delete(`${base}/api/painel/webhooks?id=${fixture.webhookId}`)).status(), 404);
  assert.equal((await gerente.request.patch(`${base}/api/painel/webhooks`, { data: { id: fixture.webhookId } })).status(), 404);
  await gerente.close();
  await page.getByLabel("Buscar fornecedor, nota, chave ou NSU", { exact: true }).fill("Fornecedor QA");
  await page.getByText("Fornecedor QA", { exact: true }).filter({ visible: true }).first().waitFor();
  await page.getByRole("link", { name: "Usar no fluxo", exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel(/^Fluxo/).selectOption(fluxoId);
  await page.getByRole("button", { name: "Confirmar encaminhamento" }).click();
  await page.getByRole("status").filter({ hasText: "Documento encaminhado" }).waitFor();
  await page.getByRole("button", { name: "Confirmar encaminhamento" }).click();
  await page.getByRole("status").filter({ hasText: "Nenhum envio novo" }).waitFor();
  const historico = await (await contexto.request.get(`${base}/api/painel/fiscal/fluxos`)).json();
  assert.equal(historico.entregas.length, 1);
  assert.equal(historico.entregas[0].documento.id, fixture.documentoId);
  assert.equal("corpo" in historico.entregas[0], false);
  assert.equal(JSON.stringify(historico).includes("segredoEnc"), false);
  const filtrado = await (await contexto.request.get(`${base}/api/painel/fiscal?tipo=resumo`)).json();
  assert.ok(filtrado.documentos.every((d: { schema: string }) => d.schema.startsWith("resNFe")));
  await mkdir("output/fiscal-fluxos-qa", { recursive: true });
  await page.screenshot({ path: "output/fiscal-fluxos-qa/desktop.png", fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Sem overflow em ${width}px`);
    await page.screenshot({ path: `output/fiscal-fluxos-qa/mobile-${width}.png`, fullPage: true });
  }
  assert.deepEqual(erros, []);
  console.log("QA fiscal: configuração, seleção, repetição, histórico, origem, sessão, permissões, isolamento, filtros e layout 1440/390/320 aprovados.");
} catch (e) {
  console.error("Falha no QA fiscal:", e);
  await mkdir("output/fiscal-fluxos-qa", { recursive: true });
  await page.screenshot({ path: "output/fiscal-fluxos-qa/falha.png", fullPage: true }).catch(() => {});
  throw e;
} finally {
  await contexto.close(); await browser.close();
  if (!fixtureExterna) await prisma.tenant.deleteMany({ where: { slug: { in: [fixture.slug, fixture.outraSlug] } } });
  await prisma.$disconnect();
}
