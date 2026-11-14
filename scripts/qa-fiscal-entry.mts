import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";
import { emitirToken } from "../src/lib/sessao";

assert.equal(process.env.CI, "true");
const db = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(db.hostname) && db.port === "5548" && db.pathname.endsWith("_test"));
const base = "http://localhost:3108", output = "artifacts/fiscal-entry-browser";
const xml = (await readFile("tests/fixtures/nfe-entrada-qa.xml", "utf8")).replaceAll("<tpAmb>2</tpAmb>", "<tpAmb>1</tpAmb>");
const chave = /<chNFe>(\d{44})<\/chNFe>/.exec(xml)![1];
const loja = await prisma.tenant.create({ data: { slug: `qa-receber-${randomUUID()}`, nome: "Loja QA Fiscal", status: "ATIVA", cnpj: "11222333000181" } });
const outra = await prisma.tenant.create({ data: { slug: `qa-receber-outra-${randomUUID()}`, nome: "Outra loja QA", status: "ATIVA" } });
const browser = await chromium.launch();
const server = spawn(process.execPath, [".next/standalone/server.js"], { env: { ...process.env, PORT: "3108", HOSTNAME: "0.0.0.0", LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0" }, stdio: "inherit" });
const cookie = `lojas_sessao=${emitirToken(loja.slug)}`;
const erros: string[] = [];
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch { /* aguarda servidor */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready);
  const produtos = await Promise.all([1, 2].map(n => salvarProdutoNoCatalogo(loja.id, null, { nome: `Produto fiscal QA ${n}`, slug: `produto-fiscal-qa-${n}`, estoque: 5, precoCentavos: 100 })));
  const variantes = await Promise.all(produtos.map(p => prisma.variante.findFirstOrThrow({ where: { tenantId: loja.id, produtoId: p.id } })));
  const doc = await prisma.documentoFiscalLoja.create({ data: { tenantId: loja.id, cnpj: loja.cnpj!, chave, nsu: "000000000000001", schema: "procNFe_v4.00.xsd", xml } });
  const chaveResumo = chave.slice(0, 25) + "000000456" + chave.slice(34);
  const resumo = await prisma.documentoFiscalLoja.create({ data: { tenantId: loja.id, cnpj: loja.cnpj!, chave: chaveResumo, nsu: "000000000000009", schema: "resNFe_v1.01.xsd", xml: `<resNFe><chNFe>${chaveResumo}</chNFe><xNome>Fornecedor resumo QA</xNome><cSitConf>0</cSitConf></resNFe>` } });
  const foreign = await prisma.documentoFiscalLoja.create({ data: { tenantId: outra.id, cnpj: "99999999000191", chave, nsu: "000000000000001", schema: "procNFe_v4.00.xsd", xml } });
  const path = `/api/painel/fiscal/documentos/${doc.id}/entrada-estoque`;
  const prepared = await fetch(base + path, { headers: { cookie } });
  assert.equal(prepared.status, 200, "Conferência deve estar acessível pelo painel compilado");
  assert.match(prepared.headers.get("cache-control") ?? "", /no-store/);
  assert.equal((await prepared.json()).nota.itens.length, 2);
  assert.equal((await fetch(base + path)).status, 401);
  assert.equal((await fetch(base + `/api/painel/fiscal/documentos/${foreign.id}/entrada-estoque`, { headers: { cookie } })).status, 404);
  const corpo = { confirmacao: true, local: "principal", itens: [{ numero: 1, varianteId: variantes[0].id, quantidade: 2 }, { numero: 2, varianteId: variantes[1].id, quantidade: 1 }] };
  assert.equal((await fetch(base + path, { method: "POST", headers: { origin: "https://localhost", "content-type": "application/json" }, body: JSON.stringify(corpo) })).status, 401);
  assert.equal((await fetch(base + `/api/painel/fiscal/documentos/${foreign.id}/entrada-estoque`, { method: "POST", headers: { cookie, origin: "https://localhost", "content-type": "application/json" }, body: JSON.stringify(corpo) })).status, 404);
  const blocked = await fetch(base + path, { method: "POST", headers: { cookie, origin: "https://other.example", "content-type": "application/json" }, body: JSON.stringify(corpo) });
  assert.equal(blocked.status, 403);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: loja.id } }), 0);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: "lojas_sessao", value: emitirToken(loja.slug), url: base }]);
  const page = await context.newPage();
  page.on("pageerror", e => erros.push(e.message));
  // The local HTTP fixture simulates the HTTPS ingress without weakening the
  // production Origin policy. API negative checks above use their real headers.
  await page.route("**/api/painel/fiscal/documentos/*/entrada-estoque", async route => {
    if (route.request().method() !== "POST") return route.continue();
    // Chromium owns Origin at the network layer. Forward the actual payload
    // through an HTTP ingress fixture instead of trying to override that header.
    const requestHeaders = await route.request().allHeaders();
    assert.ok(requestHeaders.cookie?.includes("lojas_sessao="), "O POST do navegador precisa levar a própria sessão");
    const response = await route.fetch({ headers: { ...requestHeaders, origin: "https://localhost" } });
    await route.fulfill({ response });
  });
  await page.goto(base + "/painel/configuracoes/fiscal");
  await page.getByRole("button", { name: "Conferir entrada da NF-e 456" }).click();
  const resumoDialog = page.getByRole("dialog", { name: "Conferir entrada de estoque" });
  await resumoDialog.getByRole("button", { name: "Registrar ciência da emissão" }).waitFor();
  await resumoDialog.getByRole("button", { name: "Atualizar documentos" }).waitFor();
  assert.match(await resumoDialog.innerText(), /aguardando manifestação/i);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: output + "/resumo.png", fullPage: true });
  assert.equal(await prisma.manifestacaoFiscalLoja.count({ where: { tenantId: loja.id } }), 0, "Abrir resumo nunca envia manifestação");
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: loja.id } }), 0);
  assert.equal((await fetch(base + `/api/painel/fiscal/documentos/${resumo.id}/entrada-estoque`, { headers: { cookie } })).status, 200);
  await resumoDialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Conferir entrada da NF-e 123" }).click();
  const dialog = page.getByRole("dialog", { name: "Conferir entrada de estoque" });
  await dialog.waitFor();
  for (const n of [1, 2]) {
    await page.setViewportSize(n === 1 ? { width: 393, height: 852 } : { width: 1440, height: 1100 });
    await dialog.getByLabel(`Buscar produto do item ${n}`).fill(`Produto fiscal QA ${n}`);
    await dialog.getByRole("button", { name: new RegExp(`Selecionar Produto fiscal QA ${n}`) }).click();
  }
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: output + "/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 393, height: 852 });
  await dialog.getByLabel("Unidades de estoque do item 1").fill("2");
  await dialog.getByRole("combobox", { name: /^Local de estoque/ }).fill("principal");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.screenshot({ path: output + "/mobile-form.png", fullPage: true });
  await dialog.getByLabel("Conferi os produtos, quantidades e local de estoque").check();
  const invalidos = await dialog.locator("form").evaluate(form => Array.from((form as HTMLFormElement).elements).filter(e => e instanceof HTMLInputElement && !e.validity.valid).map(e => ({ name: (e as HTMLInputElement).name, value: (e as HTMLInputElement).value, message: (e as HTMLInputElement).validationMessage })));
  assert.deepEqual(invalidos, [], "A conferência preenchida precisa passar pela validação do navegador");
  const respostaConfirmacao = page.waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Confirmar entrada no estoque", exact: true }).click();
  const confirmada = await respostaConfirmacao;
  assert.equal(confirmada.status(), 200, await confirmada.text());
  await dialog.getByRole("status").filter({ hasText: "Entrada registrada" }).waitFor();
  const saldos = await prisma.saldoEstoque.findMany({ where: { tenantId: loja.id, local: "principal" }, orderBy: { varianteId: "asc" } });
  assert.equal(saldos.find(s => s.varianteId === variantes[0].id)?.fisico, 7);
  assert.equal(saldos.find(s => s.varianteId === variantes[1].id)?.fisico, 6);
  const retry = await fetch(base + path, { method: "POST", headers: { cookie, origin: "https://localhost", "content-type": "application/json" }, body: JSON.stringify(corpo) });
  assert.equal(retry.status, 200);
  assert.equal(await prisma.razaoEstoque.count({ where: { tenantId: loja.id, origem: "fiscal:entrada-nfe" } }), 2);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({ path: output + "/mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByText("Entrada registrada", { exact: true }).first().waitFor();
  const lista = await fetch(base + "/api/painel/fiscal?tipo=nfe-recebidas", { headers: { cookie } }).then(r => r.json());
  assert.equal(lista.documentos.find((d: { id: string }) => d.id === doc.id)?.acompanhamento.estado, "ENTRADA_REGISTRADA");
  assert.equal(erros.length, 0, erros.join("; "));
  console.log(JSON.stringify({ fiscalEntryBrowser: "pass", duplicateEntry: "prevented", tenantIsolation: "pass" }));
} finally {
  await browser.close();
  server.kill("SIGTERM");
  // O banco isolado é descartado no fim do job. Recibos são imutáveis,
  // inclusive no QA: não tentar apagá-los nem mascarar a falha da jornada.
  await prisma.$disconnect();
}
