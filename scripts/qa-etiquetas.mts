import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo, salvarGradeNoCatalogo } from "../src/lib/catalogo-escrita";
import { emitirToken } from "../src/lib/sessao";

// Executar contra Next local iniciado com a mesma DATABASE_URL e LOJAS_SECRET.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("QA exige banco isolado local :5548/*_test.");
const base = "http://127.0.0.1:3089";
const pasta = "output/playwright/etiquetas";
await mkdir(pasta, { recursive: true });
const loja = await prisma.tenant.create({ data: { slug: `qa-etiquetas-${randomUUID()}`, nome: "QA Etiquetas", status: "ATIVA" } });
const browser = await chromium.launch();
try {
  const produto = await salvarProdutoNoCatalogo(loja.id, null, { nome: "Camiseta de teste", slug: "camiseta-teste", precoCentavos: 4990 });
  await salvarGradeNoCatalogo(loja.id, produto.id, ["Tamanho", "Cor"], [
    { valores: { Tamanho: "P", Cor: "Azul" }, sku: "QA-P-AZUL", precoCentavos: 4990, gtin: "036000291452" },
    { valores: { Tamanho: "G", Cor: "Azul" }, sku: "QA-G-AZUL", precoCentavos: 5990 },
  ]);
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await contexto.addCookies([{ name: "lojas_sessao", value: emitirToken(loja.slug), url: base }]);
  const page = await contexto.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(60000);
  const erros: string[] = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.goto(`${base}/painel/produtos/etiquetas?produtoId=${produto.id}`);
  await page.getByText("2 itens encontrados.", { exact: false }).waitFor();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("spinbutton").first().fill("2");
  await page.getByLabel("Incluir preço").check();
  await page.screenshot({ path: `${pasta}/desktop.png`, fullPage: true });
  const codigo = await page.locator(".etiqueta-codigo").first().textContent();
  assert.ok(codigo?.startsWith("V:"));
  await page.getByLabel("Nome, SKU ou código de barras").fill(codigo!);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByText("1 itens encontrados.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("region", { name: "Etiquetas selecionadas", exact: true }).getByRole("spinbutton").count(), 2);
  await page.getByRole("spinbutton").first().fill("201");
  assert.equal(await page.getByRole("button", { name: "Imprimir / salvar PDF" }).isDisabled(), true);
  await page.getByRole("spinbutton").first().fill("2");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${pasta}/mobile.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole("button", { name: "Imprimir / salvar PDF" }).click();
  await page.locator("#etiquetas-impressao .etiqueta-produto").first().waitFor({ state: "attached" });
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>("#etiquetas-impressao img")).every(i => i.complete && i.naturalWidth > 0));
  assert.equal(await page.locator("#etiquetas-impressao .etiqueta-produto").count(), 3);
  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: `${pasta}/impressao.png`, fullPage: true });
  await page.pdf({ path: `${pasta}/a4.pdf`, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.getByRole("combobox", { name: /^Papel/ }).selectOption("termica");
  await page.getByRole("button", { name: "Imprimir / salvar PDF" }).click();
  await page.locator("#etiquetas-impressao .etiqueta-produto").first().waitFor({ state: "attached" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: `${pasta}/termica.pdf`, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.getByLabel("Código da etiqueta").selectOption("gtin");
  await page.getByText("1 itens encontrados.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("spinbutton").count(), 0);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Imprimir / salvar PDF" }).click();
  await page.locator("#etiquetas-impressao .etiqueta-produto").first().waitFor({ state: "attached" });
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>("#etiquetas-impressao img")).every(i => i.complete && i.naturalWidth > 0));
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: `${pasta}/gtin.pdf`, preferCSSPageSize: true, printBackground: true });
  const semSessao = await browser.newContext();
  assert.equal((await semSessao.request.get(`${base}/api/painel/etiquetas`)).status(), 401);
  const op = await prisma.operadorLoja.create({ data: { tenantId: loja.id, nome: "QA operador", email: `qa-${randomUUID()}@example.test`, papel: "OPERADOR", senhaHash: "qa-nao-utilizada" } });
  await semSessao.addCookies([{ name: "lojas_sessao", value: emitirToken(loja.slug, op.id), url: base }]);
  assert.equal((await semSessao.request.get(`${base}/api/painel/etiquetas`)).status(), 403);
  assert.equal((await contexto.request.get(`${base}/api/painel/etiquetas?pagina=0`)).status(), 422);
  assert.deepEqual(erros, []);
  console.log("QA aprovado: seleção, busca por leitor, quantidades, mobile, A4, térmica, GTIN, 401/403/422 e console.");
} finally {
  await browser.close();
  await prisma.movimentoEstoque.deleteMany({ where: { tenantId: loja.id } });
  await prisma.tenant.delete({ where: { id: loja.id } });
  await prisma.$disconnect();
}
