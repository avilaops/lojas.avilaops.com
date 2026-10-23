import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import type { Produto, Tenant } from "@prisma/client";
import ModuloProductCard from "../src/components/ProductCard";

const destino = "output/vedashow-avl-265/cards-tecnicos";
await mkdir(destino, { recursive: true });

const cssDir = ".next/static/chunks";
const arquivosCss = (await readdir(cssDir)).filter((arquivo) => arquivo.endsWith(".css"));
const css = (await Promise.all(arquivosCss.map((arquivo) => readFile(`${cssDir}/${arquivo}`, "utf8")))).join("\n");
const ProductCard = (ModuloProductCard as unknown as { default: ComponentType<{
  produto: Produto;
  loja: Tenant;
  vende: boolean;
  whatsapp: string | null;
}> }).default;

const loja = {
  id: "loja",
  slug: "vedashow",
  nome: "VedaShow",
  tema: { layout: "industrial" },
  dominioPrincipal: "vedashow.com.br",
  estoqueBaixoEm: 3,
} as unknown as Tenant;

function produto(id: string, nome: string, sku: string, atributos: Record<string, unknown>): Produto {
  return {
    id,
    tenantId: loja.id,
    categoriaId: null,
    slug: id,
    nome,
    marca: "GBR",
    sku,
    gtin: null,
    precoCentavos: 4590,
    precoDeCentavos: null,
    imagens: [],
    imagemOrigem: "propria",
    destaque: false,
    ativo: true,
    disponibilidade: "out_of_stock",
    estoque: 0,
    atributos,
    compatibilidade: [],
    opcoes: [],
    codigosEquivalentes: [],
    tarja: "nenhuma",
  } as unknown as Produto;
}

const produtos = [
  produto("retentor-br", "Retentor BR 20 × 35 × 7", "RET-BR-203507", { diametroInternoMm: 20, diametroExternoMm: 35, alturaMm: 7, perfil: "BR", material: "NBR", unidade: "UN" }),
  produto("oring-182", "O-ring 18,2 × 2,4", "OR-182-24", { diametroInternoMm: 18.2, secaoMm: 2.4, material: "NBR", dureza: "70 Shore A", unidade: "UN" }),
  produto("rolamento-6204", "Rolamento 6204 2RS", "6204-2RS", { diametroInternoMm: 20, diametroExternoMm: 47, larguraMm: 14, vedacao: "2RS", unidade: "UN" }),
  produto("correia-3l300", "Correia 3L300", "3L300", { perfil: "3L", comprimentoMm: 762, unidade: "UN" }),
];

const cards = produtos.map((item) => renderToStaticMarkup(createElement(ProductCard, { produto: item, loja, vende: false, whatsapp: null }))).join("");
const html = `<!doctype html><html lang="pt-BR" data-layout="industrial"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--background:#fff;--foreground:#172033;--card:#fff;--muted:#f1f3f5;--muted-foreground:#5b6472;--border:#d8dde3;--primary:#243b87;--primary-foreground:#fff;--ring:#243b87;--radius:.65rem}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font-family:Inter,system-ui,sans-serif}${css}
.qa-main{padding:20px}.qa-main h1{margin:0 0 6px;font-size:24px}.qa-main>p{margin:0 0 16px;color:var(--muted-foreground)}.qa-grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(min-width:700px){.qa-grade{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}
</style></head><body><main class="qa-main"><h1>Comparação técnica</h1><p>Somente especificações cadastradas no produto.</p><section class="qa-grade">${cards}</section></main></body></html>`;

const browser = await chromium.launch({ headless: true, executablePath: "/home/avops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" });
const resultados = [];
type Medicao = { overflowHorizontal: boolean; cards: number; unidades: number; menorCtaPx: number };
for (const viewport of [{ nome: "mobile-390", width: 390, height: 844 }, { nome: "desktop-1280", width: 1280, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  await page.setContent(html, { waitUntil: "load" });
  const medicao = await page.evaluate(`(() => ({
    overflowHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    cards: document.querySelectorAll('.cartao-produto').length,
    unidades: Array.from(document.querySelectorAll('.cartao-produto-identificacao span')).filter((el) => el.textContent?.startsWith('Venda:')).length,
    menorCtaPx: Math.min(...Array.from(document.querySelectorAll('.cartao-produto .btn-primario, .cartao-produto .btn-secundario')).map((el) => Math.round(el.getBoundingClientRect().height)).filter(Boolean)),
  }))()`) as Medicao;
  resultados.push({ viewport: viewport.nome, ...medicao });
  await page.screenshot({ path: `${destino}/${viewport.nome}.png`, fullPage: true });
  await page.close();
}
await browser.close();
await writeFile(`${destino}/medidas.json`, `${JSON.stringify(resultados, null, 2)}\n`);
console.log(JSON.stringify(resultados, null, 2));
