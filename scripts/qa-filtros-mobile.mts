import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import ModuloFiltrosProdutos from "../src/components/FiltrosProdutos";
import ModuloHeader from "../src/components/Header";
import ModuloBarraInferior from "../src/components/BarraInferior";
import ModuloConsentimento from "../src/components/Consentimento";
import ModuloWhatsAppFlutuante from "../src/components/WhatsAppFlutuante";
import { CartProvider } from "../src/components/cart/CartProvider";
import type { TenantPublico } from "../src/lib/tenant";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

const destino = "output/vedashow-avl-265/filtros-mobile";
await mkdir(destino, { recursive: true });

const cssDir = ".next/static/chunks";
const arquivosCss = (await readdir(cssDir)).filter((arquivo) => arquivo.endsWith(".css"));
const css = (await Promise.all(arquivosCss.map((arquivo) => readFile(`${cssDir}/${arquivo}`, "utf8")))).join("\n");
const axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
// `tsx` preserva a fronteira CJS deste componente quando o chamador é `.mts`.
// No app e nos testes `.ts` o default já é direto; aqui ele vem embrulhado.
const FiltrosProdutos = (ModuloFiltrosProdutos as unknown as { default: ComponentType<{
  categorias: never[];
  valores: Record<string, string | undefined>;
  categoriaFixa: boolean;
  fabricantes?: Array<{ nome: string; itens: number; grafias: string[] }>;
}> }).default;
const Header = (ModuloHeader as unknown as { default: ComponentType<{
  loja: TenantPublico;
  logoUrl: string | null;
  categorias: Array<{ slug: string; nome: string }>;
  exemploBusca?: string | null;
}> }).default;
const BarraInferior = (ModuloBarraInferior as unknown as { default: ComponentType<{ vende: boolean; temContato: boolean }> }).default;
const Consentimento = (ModuloConsentimento as unknown as { default: ComponentType<{ ativo: boolean }> }).default;
const WhatsAppFlutuante = (ModuloWhatsAppFlutuante as unknown as { default: ComponentType<{ numero: string; nome: string }> }).default;
const CartProviderQA = CartProvider as ComponentType<{ slug: string; children?: ReactNode }>;
const categorias = ["Retentores", "O-rings", "Rolamentos", "Correias", "Gaxetas", "Raspadores", "Vedações hidráulicas", "Kits", "Anéis guia", "Acoplamentos"]
  .map((nome, indice) => ({ nome, slug: `categoria-${indice + 1}` }));
const roteadorInerte: AppRouterInstance = {
  back() {}, forward() {}, refresh() {},
  push() {}, replace() {}, prefetch() {},
};
function renderizarCabecalho(slug: string, nome: string, categoriasDaLoja: typeof categorias) {
  const componente = createElement(Header, {
    loja: {
      slug,
      nome,
    plano: "SITE",
    status: "ATIVA",
    whatsapp: null,
    mpPublicKey: null,
    meiosPagamento: [],
    pixNaConta: false,
    retiradaNaLoja: true,
    despachoDiasUteis: 1,
    estoqueBaixoEm: 3,
    freteGratisAcima: null,
    pedidoMinimoCentavos: null,
    avisoTopo: null,
    segmento: "geral",
    configuradorSobMedida: false,
    vende: false,
    },
    logoUrl: null,
    categorias: categoriasDaLoja,
    exemploBusca: slug === "vedashow" ? "Correia 3L300" : "Nome ou código do produto",
  });
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: roteadorInerte },
      createElement(PathnameContext.Provider, { value: "/categoria/correias" }, componente),
    ),
  );
}
const cabecalho = renderizarCabecalho("vedashow", "VedaShow", categorias);
const categoriasDomiRio = ["Ferramentas", "Elétrica", "Hidráulica", "Fixadores", "Segurança", "Acessórios"]
  .map((nome, indice) => ({ nome, slug: `domi-categoria-${indice + 1}` }));
const cabecalhoDomiRio = renderizarCabecalho("domi-rio", "DOMI-Rio", categoriasDomiRio);
const filtros = renderToStaticMarkup(createElement(FiltrosProdutos, {
  categorias: [],
  valores: {},
  categoriaFixa: true,
}));
const filtrosAtivos = renderToStaticMarkup(createElement(FiltrosProdutos, {
  categorias: [],
  valores: { fabricante: "SKF" },
  categoriaFixa: true,
  fabricantes: [{ nome: "SKF", itens: 48, grafias: ["SKF"] }],
}));
const elementosFixos = renderToStaticMarkup(
  createElement(AppRouterContext.Provider, { value: roteadorInerte },
    createElement(PathnameContext.Provider, { value: "/categoria/correias" },
      createElement(CartProviderQA, { slug: "vedashow" },
        createElement(BarraInferior, { vende: false, temContato: true }),
        createElement(WhatsAppFlutuante, { numero: "5516999990000", nome: "VedaShow" }),
        createElement(Consentimento, { ativo: true }),
      ),
    ),
  ),
);

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catálogo VedaShow</title><style>
:root{--background:#fff;--foreground:#172033;--card:#fff;--muted:#f1f3f5;--muted-foreground:#5b6472;--border:#d8dde3;--primary:#243b87;--primary-foreground:#fff;--ring:#243b87;--radius:.65rem}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font-family:Inter,system-ui,sans-serif}${css}
.qa-main{padding-top:16px!important;padding-bottom:32px!important}.qa-main h1{margin:0;font-size:24px}.qa-contagem{margin:4px 0 12px;color:var(--muted-foreground);font-size:14px}.qa-produtos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.qa-card{min-height:210px;border:1px solid var(--border);border-radius:12px;padding:10px}.qa-foto{height:92px;border-radius:8px;background:#eef1f5}.qa-card h2{margin:8px 0 2px;font-size:14px;line-height:1.25}.qa-card small{color:var(--muted-foreground)}.qa-card strong{display:block;margin-top:8px;color:var(--primary)}
</style></head><body>${cabecalho}<main class="container-loja qa-main"><nav class="trilha" aria-label="Navegação estrutural">Início › Correias</nav><h1>Correias</h1><p class="qa-contagem">48 produtos encontrados</p>${filtros}<section class="qa-produtos"><article class="qa-card cartao-produto"><div class="qa-foto"></div><h2>Correia 3L300</h2><small>Referência 3L300</small><strong>R$ 38,90</strong></article><article class="qa-card cartao-produto"><div class="qa-foto"></div><h2>Correia A-42</h2><small>Referência A42</small><strong>R$ 44,90</strong></article></section></main>${elementosFixos}</body></html>`;

type Resultado = {
  cabecalhoPx: number | null;
  primeiroProdutoPx: number | null;
  primeiroProdutoEmTelas: number | null;
  filtrarAlturaPx: number | null;
  ordenarAlturaPx: number | null;
  mesmaLinha: boolean;
  categoriasRolaveis: boolean;
  menorCategoriaPx: number | null;
  verTodas: boolean;
  categoriasNoMenu: number;
  overflowHorizontal: boolean;
  whatsappOcultoNoCatalogo: boolean;
  barraSobrepoeProduto: boolean;
  falhasAcessibilidadeSerias: string[];
};
type ResultadoFixos = {
  whatsappVisivelDuranteCookies: boolean;
  whatsappVisivelAposConsentimento: boolean;
  barraWhatsappSobrepostos: boolean;
  barraCookiesSobrepostos: boolean;
  whatsappCookiesSobrepostos: boolean;
  barraAlturaPx: number | null;
  whatsappAlvoAposConsentimentoPx: [number, number] | null;
};

const browser = await chromium.launch({
  headless: true,
  executablePath: "/home/avops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
const resultados = [];
for (const largura of [360, 390, 430]) {
  const page = await browser.newPage({ viewport: { width: largura, height: 844 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.addScriptTag({ content: axeSource });
  // String evita o helper `__name` que o tsx injeta em funções serializadas.
  const resultado = await page.evaluate(`(() => {
    const caixa = (seletor) => document.querySelector(seletor)?.getBoundingClientRect();
    const produto = caixa(".qa-card");
    const filtrar = caixa(".filtros-abrir");
    const ordenar = caixa(".filtros-ordem-principal");
    const faixa = document.querySelector(".nav-loja-tira");
    const categorias = Array.from(document.querySelectorAll(".nav-loja a"));
    return {
      cabecalhoPx: caixa(".cabecalho-loja") ? Math.round(caixa(".cabecalho-loja").height) : null,
      primeiroProdutoPx: produto ? Math.round(produto.top) : null,
      primeiroProdutoEmTelas: produto ? Number((produto.top / innerHeight).toFixed(2)) : null,
      filtrarAlturaPx: filtrar ? Math.round(filtrar.height) : null,
      ordenarAlturaPx: ordenar ? Math.round(ordenar.height) : null,
      mesmaLinha: Boolean(filtrar && ordenar && Math.abs(filtrar.top - ordenar.top) < 2),
      categoriasRolaveis: Boolean(faixa && faixa.scrollWidth > faixa.clientWidth),
      menorCategoriaPx: categorias.length ? Math.min(...categorias.map((el) => Math.round(el.getBoundingClientRect().height))) : null,
      verTodas: categorias.some((el) => el.textContent?.trim() === "Ver todas"),
      categoriasNoMenu: document.querySelectorAll(".menu-mobile-dialog a[href^='/categoria/']").length,
      overflowHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      whatsappOcultoNoCatalogo: getComputedStyle(document.querySelector('.whatsapp-flutuante')).display === 'none',
      barraSobrepoeProduto: (() => {
        const barra = caixa('.barra-inferior');
        const produto = caixa('.qa-card');
        return Boolean(barra && produto && barra.top < produto.bottom && barra.bottom > produto.top);
      })(),
    };
  })()`) as Resultado;
  const axe = await page.evaluate(async () => {
    const axeNoNavegador = (window as unknown as { axe: {
      run: (contexto: Document, opcoes: { resultTypes: string[] }) => Promise<{
        violations: Array<{ id: string; impact: string | null }>;
      }>;
    } }).axe;
    const resultado = await axeNoNavegador.run(document, { resultTypes: ["violations"] });
    return resultado.violations
      .filter((violacao) => violacao.impact === "critical" || violacao.impact === "serious")
      .map((violacao) => violacao.id);
  });
  resultado.falhasAcessibilidadeSerias = axe;
  resultados.push({ largura, ...resultado });
  await page.screenshot({ path: `${destino}/${largura}.png`, fullPage: false });
  await page.close();
}
const pageAtiva = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await pageAtiva.setContent(html.replace(filtros, filtrosAtivos), { waitUntil: "load" });
await pageAtiva.evaluate(() => window.scrollTo(0, 0));
const estadoAtivo = await pageAtiva.evaluate(`(() => ({
  gavetaAberta: document.querySelector('#filtros-mais')?.checked === true,
  seloVisivel: Boolean(document.body.textContent?.includes('Filtros ativos')),
  limparVisivel: Boolean(document.body.textContent?.includes('Limpar busca e filtros')),
  overflowHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))()`);
await pageAtiva.screenshot({ path: `${destino}/390-ativos.png`, fullPage: true });
await pageAtiva.close();
const pageFixos = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await pageFixos.setContent(html.replaceAll(" cartao-produto", ""), { waitUntil: "load" });
const fixos = await pageFixos.evaluate(`(() => {
  const caixa = (seletor) => document.querySelector(seletor)?.getBoundingClientRect();
  const sobrepoe = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
  const barra = caixa('.barra-inferior');
  const whatsapp = caixa('.whatsapp-flutuante');
  const cookies = caixa('.aviso-cookies');
  const whatsappVisivelDuranteCookies = getComputedStyle(document.querySelector('.whatsapp-flutuante')).display !== 'none';
  document.querySelector('.aviso-cookies')?.remove();
  const whatsappAposConsentimento = caixa('.whatsapp-flutuante');
  return {
    whatsappVisivelDuranteCookies,
    whatsappVisivelAposConsentimento: getComputedStyle(document.querySelector('.whatsapp-flutuante')).display !== 'none',
    barraWhatsappSobrepostos: sobrepoe(barra, whatsapp),
    barraCookiesSobrepostos: sobrepoe(barra, cookies),
    whatsappCookiesSobrepostos: sobrepoe(whatsapp, cookies),
    barraAlturaPx: barra ? Math.round(barra.height) : null,
    whatsappAlvoAposConsentimentoPx: whatsappAposConsentimento ? [Math.round(whatsappAposConsentimento.width), Math.round(whatsappAposConsentimento.height)] : null,
  };
})()`) as ResultadoFixos;
await pageFixos.screenshot({ path: `${destino}/390-elementos-fixos.png`, fullPage: false });
await pageFixos.close();
const pageDomiRio = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const htmlDomiRio = html
  .replace(cabecalho, cabecalhoDomiRio)
  .replaceAll("VedaShow", "DOMI-Rio")
  .replaceAll("Correias", "Ferramentas")
  .replace("Correia 3L300", "Chave combinada 10 mm")
  .replace("Referência 3L300", "Referência CH10")
  .replace("Correia A-42", "Alicate universal 8 pol")
  .replace("Referência A42", "Referência AL8");
await pageDomiRio.setContent(htmlDomiRio, { waitUntil: "load" });
await pageDomiRio.addScriptTag({ content: axeSource });
const domiRio = await pageDomiRio.evaluate(async () => {
  const axeNoNavegador = (window as unknown as { axe: {
    run: (contexto: Document, opcoes: { resultTypes: string[] }) => Promise<{
      violations: Array<{ id: string; impact: string | null }>;
    }>;
  } }).axe;
  const resultadoAxe = await axeNoNavegador.run(document, { resultTypes: ["violations"] });
  const produto = document.querySelector(".qa-card")?.getBoundingClientRect();
  return {
    identidadeCorreta: document.body.textContent?.includes("DOMI-Rio") === true && !document.body.textContent?.includes("VedaShow"),
    primeiroProdutoEmTelas: produto ? Number((produto.top / innerHeight).toFixed(2)) : null,
    overflowHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    whatsappOcultoNoCatalogo: getComputedStyle(document.querySelector(".whatsapp-flutuante")!).display === "none",
    falhasAcessibilidadeSerias: resultadoAxe.violations
      .filter((violacao) => violacao.impact === "critical" || violacao.impact === "serious")
      .map((violacao) => violacao.id),
  };
});
await pageDomiRio.screenshot({ path: `${destino}/390-domi-rio.png`, fullPage: false });
await pageDomiRio.close();
await browser.close();
const evidencia = { vazio: resultados, ativo: estadoAtivo, fixos, domiRio };
for (const resultado of resultados) {
  assert.equal(resultado.overflowHorizontal, false, `${resultado.largura}px não pode ter overflow horizontal`);
  assert.equal(resultado.whatsappOcultoNoCatalogo, true, `${resultado.largura}px deve ocultar o WhatsApp sobre cards`);
  assert.equal(resultado.barraSobrepoeProduto, false, `${resultado.largura}px não pode cobrir o primeiro produto`);
  assert.deepEqual(resultado.falhasAcessibilidadeSerias, [], `${resultado.largura}px não pode ter violações axe sérias ou críticas`);
}
assert.equal(fixos.barraWhatsappSobrepostos, false, "barra inferior e WhatsApp não podem se sobrepor");
assert.equal(fixos.barraCookiesSobrepostos, false, "barra inferior e aviso de cookies não podem se sobrepor");
assert.equal(fixos.whatsappVisivelDuranteCookies, false, "WhatsApp deve sair enquanto o aviso de cookies pede uma decisão");
assert.equal(fixos.whatsappVisivelAposConsentimento, true, "WhatsApp deve voltar após a decisão sobre cookies");
assert.deepEqual(fixos.whatsappAlvoAposConsentimentoPx, [56, 56], "WhatsApp deve manter alvo de toque de 56 px");
assert.equal(fixos.whatsappCookiesSobrepostos, false, "WhatsApp e aviso de cookies não podem se sobrepor");
assert.equal(domiRio.identidadeCorreta, true, "o cenário Domi-Rio não pode herdar a identidade da VedaShow");
assert.equal(domiRio.overflowHorizontal, false, "o catálogo Domi-Rio não pode ter overflow horizontal");
assert.equal(domiRio.whatsappOcultoNoCatalogo, true, "o WhatsApp não pode cobrir cards na Domi-Rio");
assert.deepEqual(domiRio.falhasAcessibilidadeSerias, [], "a regressão Domi-Rio não pode ter violações axe sérias ou críticas");
await writeFile(`${destino}/medidas.json`, `${JSON.stringify(evidencia, null, 2)}\n`);
console.log(JSON.stringify(evidencia, null, 2));
