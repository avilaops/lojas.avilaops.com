import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";

const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (banco.hostname !== "127.0.0.1" || banco.port !== "5548" || !banco.pathname.endsWith("_test")) {
  throw new Error("QA exige o banco isolado 127.0.0.1:5548/*_test.");
}

const slug = `vedashow-seletores-${Date.now()}`;
const origem = `http://${slug}.localhost:3080`;
const destino = "output/vedashow-avl-269/seletores-tecnicos";
const erros: string[] = [];

const casos = [
  { slug: "retentores", nome: "Retentores", produto: "Retentor QA TC", sku: "RET-QA-254007", atributos: { diametroInternoMm: 25, diametroExternoMm: 40, alturaMm: 7, perfil: "TC", material: "NBR" }, campos: ["Diâmetro interno mínimo em mm", "Diâmetro externo mínimo em mm", "Altura mínimo em mm", "Perfil", "Material"] },
  { slug: "o-rings", nome: "O-Rings", produto: "O-Ring QA NBR", sku: "ORI-QA-1824", atributos: { diametroInternoMm: 18.2, secaoMm: 2.4, material: "NBR", dureza: "70 Shore A" }, campos: ["Diâmetro interno mínimo em mm", "Seção do cordão mínimo em mm", "Material", "Dureza"] },
  { slug: "rolamentos", nome: "Rolamentos", produto: "Rolamento QA 6204 2RS", sku: "ROL-QA-6204", atributos: { diametroInternoMm: 20, diametroExternoMm: 47, alturaMm: 14, vedacao: "2RS" }, campos: ["Diâmetro interno mínimo em mm", "Diâmetro externo mínimo em mm", "Altura mínimo em mm", "Tipo de vedação"] },
  { slug: "correias", nome: "Correias", produto: "Correia QA 3L300", sku: "COR-QA-3L300", atributos: { comprimentoMm: 762, perfil: "3L" }, campos: ["Comprimento mínimo em mm", "Perfil"] },
  { slug: "vedacoes-hidraulicas", nome: "Vedações Hidráulicas", produto: "Gaxeta QA PU", sku: "GAX-QA-508", atributos: { diametroInternoMm: 50.8, diametroExternoMm: 63.5, alturaMm: 9.52, perfil: "U", material: "Poliuretano (PU)" }, campos: ["Diâmetro interno mínimo em mm", "Diâmetro externo mínimo em mm", "Altura mínimo em mm", "Perfil", "Material"] },
] as const;

async function auditarAcessibilidade(page: Page) {
  await page.addScriptTag({ content: await readFile("node_modules/axe-core/axe.min.js", "utf8") });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (documento: Document) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe;
    const resultado = await axe.run(document);
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      violacoes: resultado.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id),
    };
  });
}

async function main() {
  await mkdir(destino, { recursive: true });
  const tenant = await prisma.tenant.create({ data: { slug, nome: "VedaShow · seletores QA", status: "ATIVA", plano: "SITE", whatsapp: "5516999999999" } });
  for (const [ordem, caso] of casos.entries()) {
    const categoria = await prisma.categoria.create({ data: { tenantId: tenant.id, slug: caso.slug, nome: caso.nome, ordem } });
    await salvarProdutoNoCatalogo(tenant.id, null, { nome: caso.produto, slug: caso.slug + "-qa", sku: caso.sku, categoriaId: categoria.id, precoCentavos: 1000 + ordem, estoque: 2, atributos: caso.atributos });
  }

  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/home/avops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (erro) => erros.push(erro.message));
  const resultados = [];
  for (const caso of casos) {
    console.log(`QA ${caso.slug}`);
    await page.goto(`${origem}/categoria/${caso.slug}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByText(caso.produto, { exact: true }).waitFor();
    for (const campo of caso.campos) await page.getByLabel(campo, { exact: true }).waitFor();
    const primeiroCampo = caso.campos.find((campo) => campo.includes("mínimo em mm"));
    assert.ok(primeiroCampo);
    const valor = caso.slug === "correias" ? "762" : caso.slug === "o-rings" ? "18,2" : caso.slug === "vedacoes-hidraulicas" ? "50,8" : caso.slug === "retentores" ? "25" : "20";
    await page.getByLabel(primeiroCampo, { exact: true }).fill(valor);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForLoadState("domcontentloaded");
    await page.getByText(caso.produto, { exact: true }).waitFor();
    const qualidade = await auditarAcessibilidade(page);
    assert.equal(qualidade.overflow, false);
    assert.deepEqual(qualidade.violacoes, []);
    await page.screenshot({ path: `${destino}/${caso.slug}-mobile.png`, fullPage: true });
    resultados.push({ familia: caso.nome, url: page.url(), campos: caso.campos, produto: caso.produto, ...qualidade });
  }
  assert.deepEqual(erros, []);
  await writeFile(`${destino}/resultado.json`, JSON.stringify({ tenant: slug, resultados, erros }, null, 2) + "\n");
  await browser.close();
  console.log(JSON.stringify({ tenant: slug, resultados }, null, 2));
}

main().finally(() => prisma.$disconnect());
