import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita.ts";
import { contratoPadraoAninhado } from "../src/lib/contratos-comerciais.ts";
import { definirPadrao, salvarCredencial } from "../src/lib/credenciais.ts";
import { provedoresDePagamento } from "../src/lib/provedores-pagamento.ts";

assert.equal(process.env.CI, "true", "Prova exclusiva do GitHub CI");
const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["127.0.0.1", "localhost"].includes(banco.hostname) && banco.port === "5548" && banco.pathname.endsWith("_test"), "Banco isolado obrigatório");
const prisma = new PrismaClient();
const slug = `qa-cookies-${randomUUID().slice(0, 8)}`;
const porta = "3114";
const base = `http://${slug}.localhost:${porta}`;
const pasta = "artifacts/consentimento-browser";
const resultados: Array<Record<string, unknown>> = [];
let tenantId: string | undefined;
let bloqueadas = 0;
let fixtures = 0;
type Registro = { nome: string; inicio: number; duracao: number };
type JanelaQA = typeof window & {
  dataLayer?: ArrayLike<unknown>[];
  __qaMeta: unknown[][];
  __qaTiktok: unknown[][];
  __qaTempos: Registro[];
  fbq?: unknown;
  ttq?: unknown;
};
const navegador = await chromium.launch({ headless: true });
const servidor = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, PORT: porta, HOSTNAME: "0.0.0.0", LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0", PLATAFORMA_GTM_ID: "GTM-COOKIEQA", SSO_APP_ID: "", LOJAS_OIDC_CLIENT_ID: "", LOJAS_OIDC_CLIENT_SECRET: "" },
  stdio: "inherit",
});

// Os SDKs são fixtures transparentes: registram chamadas inclusive após revoke.
// Nenhum SDK remoto nem coletor real participa desta prova do código compilado.
const meta = `window.__qaMeta=[];var q=window.fbq;var registrar=function(){window.__qaMeta.push(Array.from(arguments))};q.callMethod=registrar;(q.queue||[]).forEach(function(x){registrar.apply(null,x)});q.queue=[];`;
const tiktok = `window.__qaTiktok=[];var q=window.ttq;Array.from(q).forEach(function(x){window.__qaTiktok.push(Array.from(x))});q.methods.forEach(function(n){q[n]=function(){window.__qaTiktok.push([n].concat(Array.from(arguments)))}});`;

async function contexto(escolha: string | null, width = 390): Promise<BrowserContext> {
  const c = await navegador.newContext({ viewport: { width, height: 900 } });
  await c.route("**/*", async (rota) => {
    const u = new URL(rota.request().url());
    if (u.hostname === "connect.facebook.net" && u.pathname.endsWith("/fbevents.js")) { fixtures++; return rota.fulfill({ contentType: "application/javascript", body: meta }); }
    if (u.hostname === "analytics.tiktok.com" && u.pathname.endsWith("/events.js")) { fixtures++; return rota.fulfill({ contentType: "application/javascript", body: tiktok }); }
    if (u.hostname === "www.googletagmanager.com" && ["/gtm.js", "/gtag/js"].includes(u.pathname)) { fixtures++; return rota.fulfill({ contentType: "application/javascript", body: "/* Google fixture • mantém a fila nativa */" }); }
    if ((u.hostname === `${slug}.localhost` || u.hostname === "localhost") && u.port === porta) {
      if (u.pathname.startsWith("/api/vitrine/")) { bloqueadas++; return rota.fulfill({ status: 204 }); }
      return rota.continue();
    }
    bloqueadas++;
    return rota.abort();
  });
  await c.addInitScript(({ escolha }) => {
    const w = window as JanelaQA;
    w.__qaMeta = [];
    w.__qaTiktok = [];
    w.__qaTempos = [];
    localStorage.setItem("qa_preferencia_necessaria", "preservar");
    sessionStorage.setItem("qa_sessao_necessaria", "preservar");
    if (escolha !== null) localStorage.setItem("loja_consentimento", JSON.stringify({ escolha, versao: 1, em: "2026-11-01T00:00:00.000Z" }));
    try { new PerformanceObserver((lista) => { for (const e of lista.getEntries()) w.__qaTempos.push({ nome: e.entryType + ":" + e.name, inicio: e.startTime, duracao: e.duration }); }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit); } catch { /* suporte opcional do navegador */ }
    try { new PerformanceObserver((lista) => { for (const e of lista.getEntries()) w.__qaTempos.push({ nome: "longtask", inicio: e.startTime, duracao: e.duration }); }).observe({ type: "longtask" }); } catch { /* suporte opcional do navegador */ }
  }, { escolha });
  await c.addCookies([{ name: "qa_necessario", value: "preservar", url: base }]);
  return c;
}
async function abrir(p: Page) {
  await p.getByRole("button", { name: "Preferências de cookies", exact: true }).click();
  await p.getByRole("dialog", { name: "Preferências de cookies", exact: true }).waitFor();
}
async function estado(p: Page, medicao: boolean, publicidade: boolean) {
  await p.waitForFunction(({ medicao, publicidade }) => {
    const fila = (window as JanelaQA).dataLayer ?? [];
    const comando = Array.from(fila).map((x) => Array.from(x)).filter((x) => x[0] === "consent").at(-1);
    const atual = comando?.[2] as Record<string, string> | undefined;
    return atual?.analytics_storage === (medicao ? "granted" : "denied") && ["ad_storage", "ad_user_data", "ad_personalization"].every((k) => atual?.[k] === (publicidade ? "granted" : "denied"));
  }, { medicao, publicidade });
}
async function salvar(p: Page, medicao: boolean, publicidade: boolean) {
  await abrir(p);
  await p.getByLabel("Medição de audiência", { exact: true }).setChecked(medicao);
  await p.getByLabel("Publicidade", { exact: true }).setChecked(publicidade);
  await p.getByRole("button", { name: "Salvar preferências", exact: true }).click();
  assert.equal(await p.getByRole("dialog").count(), 0);
  await estado(p, medicao, publicidade);
}
async function preservados(p: Page) {
  assert.deepEqual(await p.evaluate(() => [localStorage.getItem("qa_preferencia_necessaria"), sessionStorage.getItem("qa_sessao_necessaria")]), ["preservar", "preservar"]);
  assert.equal((await p.context().cookies()).find((c) => c.name === "qa_necessario")?.value, "preservar");
}

try {
  await mkdir(pasta, { recursive: true });
  const loja = await prisma.tenant.create({ data: { slug, nome: "Cookies QA", status: "ATIVA", plano: "LOJA", tema: { layout: "automotivo", categoriaSemImagem: "icone" }, recursos: ["pagamentos_pix_manual", "recebimento_v2"], gtmId: "GTM-COOKIEQA", metaPixelId: "123456789012345", tiktokPixelId: "COOKIEQATEST123456789", ga4Id: "G-COOKIEQA", contratosComerciais: { create: contratoPadraoAninhado("LOJA", { aceiteEm: null, aceiteReferencia: null, origem: "QA isolado de cookies" }) } } });
  tenantId = loja.id;
  // Mesmo provedor local da jornada já existente, sem endpoint de pagamento.
  const provedor = provedoresDePagamento.obter("pix_manual");
  const publicos = { chavePix: randomUUID(), nomeRecebedor: "Cookies QA sem pagamento" };
  const teste = await provedor.testarConexao({ segredos: {}, publicos });
  assert.equal(teste.ok, true);
  const credencial = await salvarCredencial(loja, "pix_manual", { segredos: {}, publicos }, teste);
  await definirPadrao(loja, credencial.id);
  await salvarProdutoNoCatalogo(loja.id, null, { nome: "Produto cookies QA", slug: "produto-qa", sku: "COOKIE-QA", precoCentavos: 1500, estoque: 10 });
  let pronto = false;
  for (let n = 0; n < 90; n++) {
    if ((await fetch(`http://127.0.0.1:${porta}/api/health`).catch(() => null))?.ok) { pronto = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(pronto, "Build iniciou no loopback");
  const respostaHtml = await fetch(`http://127.0.0.1:${porta}/`, { headers: { host: "backend-render.example", "x-forwarded-host": `${slug}.localhost` } });
  assert.equal(respostaHtml.status, 200, "SSR resolve o host lógico da fixture no mesmo socket local");
  const html = await respostaHtml.text();
  assert.doesNotMatch(html, /<div[^>]*role="dialog"/);
  assert.match(html, /Preferências de cookies/);

  for (const [escolha, medicao, publicidade] of [["essencial", false, false], ["medicao", true, false], ["publicidade", false, true], ["aceito", true, true]] as const) {
    const c = await contexto(null, publicidade ? 1440 : 390);
    const p = await c.newPage();
    const erros: string[] = [];
    p.on("pageerror", (erro) => erros.push(erro.message));
    await p.goto(base);
    await p.waitForLoadState("networkidle");
    assert.equal(await p.getByRole("dialog").count(), 0, "Visita fria sem popup");
    await estado(p, false, false);
    assert.equal(await p.evaluate(() => localStorage.getItem("loja_consentimento")), null);
    await abrir(p);
    assert.equal(await p.getByLabel("Medição de audiência").isChecked(), false);
    assert.equal(await p.getByLabel("Publicidade", { exact: true }).isChecked(), false);
    await p.getByLabel("Publicidade", { exact: true }).check();
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await estado(p, false, false);
    assert.equal(await p.evaluate(() => localStorage.getItem("loja_consentimento")), null, "Fechar descarta edição");
    await salvar(p, medicao, publicidade);
    const bruto = await p.evaluate(() => localStorage.getItem("loja_consentimento"));
    assert.equal(JSON.parse(bruto!).escolha, escolha);
    await abrir(p);
    assert.equal(await p.getByLabel("Medição de audiência").isChecked(), medicao);
    assert.equal(await p.getByLabel("Publicidade", { exact: true }).isChecked(), publicidade);
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    assert.equal(await p.evaluate(() => localStorage.getItem("loja_consentimento")), bruto, "Abrir e fechar preserva escolha e data");
    await estado(p, medicao, publicidade);
    await p.reload();
    await p.waitForLoadState("networkidle");
    await estado(p, medicao, publicidade);
    assert.equal(await p.getByRole("dialog").count(), 0, "Escolha restaurada sem popup");
    assert.equal(await p.evaluate(() => typeof (window as JanelaQA).fbq !== "undefined"), publicidade);
    assert.equal(await p.evaluate(() => typeof (window as JanelaQA).ttq !== "undefined"), publicidade);
    await p.locator('a[href="/produtos/produto-qa"]').first().click();
    await p.waitForURL(/\/produtos\/produto-qa$/);
    await p.getByRole("button", { name: "Adicionar ao carrinho: Produto cookies QA", exact: true }).waitFor();
    await p.getByRole("button", { name: "Adicionar ao carrinho: Produto cookies QA", exact: true }).click();
    await p.waitForURL(/\/carrinho$/);
    const envio = await p.evaluate(() => {
      const w = window as JanelaQA;
      return { meta: w.__qaMeta.filter((x) => x[0] === "track" && x[1] === "AddToCart").length, tiktok: w.__qaTiktok.filter((x) => x[0] === "track" && x[1] === "AddToCart").length, google: (w.dataLayer ?? []).some((x) => (x as unknown as { event?: string }).event === "add_to_cart") };
    });
    assert.deepEqual(envio, { meta: publicidade ? 1 : 0, tiktok: publicidade ? 1 : 0, google: true });
    await preservados(p);
    assert.deepEqual(erros, []);
    resultados.push({ escolha, medicao, publicidade, restauracao: "pass", eventos: envio });
    await c.close();
  }

  // Valores anteriores versão 1 são lidos antes da hidratação, sem migração.
  for (const escolha of ["aceito", "essencial"] as const) {
    const c = await contexto(escolha);
    const p = await c.newPage();
    await p.goto(base);
    await p.waitForLoadState("networkidle");
    await estado(p, escolha === "aceito", escolha === "aceito");
    assert.equal(await p.getByRole("dialog").count(), 0);
    const antes = await p.evaluate(() => localStorage.getItem("loja_consentimento"));
    await abrir(p);
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    assert.equal(await p.evaluate(() => localStorage.getItem("loja_consentimento")), antes);
    resultados.push({ legado: escolha, versao: 1, preservado: true });
    await c.close();
  }

  const c = await contexto(null);
  const p = await c.newPage();
  await p.goto(base + "/produtos/produto-qa");
  await p.waitForLoadState("networkidle");
  await abrir(p);
  await p.getByRole("button", { name: "Aceitar todos", exact: true }).click();
  await estado(p, true, true);
  await p.waitForFunction(() => (window as JanelaQA).__qaMeta.some((x) => x[0] === "track") && (window as JanelaQA).__qaTiktok.some((x) => x[0] === "page"));
  await salvar(p, true, false);
  const contagem = () => p.evaluate(() => { const w = window as JanelaQA; return [w.__qaMeta.filter((x) => x[0] === "track").length, w.__qaTiktok.filter((x) => x[0] === "track").length]; });
  const antes = await contagem();
  assert.deepEqual(await p.evaluate(() => {
    const w = window as JanelaQA;
    return { meta: w.__qaMeta.some((x) => x[0] === "consent" && x[1] === "revoke"), tiktok: w.__qaTiktok.some((x) => x[0] === "revokeConsent"), globais: Boolean(w.fbq && w.ttq) };
  }), { meta: true, tiktok: true, globais: true });
  await p.getByRole("button", { name: "Adicionar ao carrinho: Produto cookies QA", exact: true }).click();
  await p.waitForURL(/\/carrinho$/);
  assert.deepEqual(await contagem(), antes, "Aplicação não chama SDKs após revogar publicidade");
  const fixturesAntes = fixtures;
  await salvar(p, false, true);
  await p.locator('a[href="/produtos/produto-qa"]').first().click();
  await p.waitForURL(/\/produtos\/produto-qa$/);
  await p.waitForFunction(() => (window as JanelaQA).__qaMeta.some((x) => x[0] === "track" && x[1] === "ViewContent") && (window as JanelaQA).__qaTiktok.some((x) => x[0] === "track" && x[1] === "ViewContent"));
  assert.equal(fixtures, fixturesAntes, "Reativar usa SDK existente sem outro loader");
  await salvar(p, true, false);
  await abrir(p);
  await p.screenshot({ path: `${pasta}/painel-mobile.png`, fullPage: true });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await p.getByRole("button", { name: "Recusar opcionais", exact: true }).click();
  await estado(p, false, false);
  await preservados(p);
  resultados.push({ revogacaoComSdkPresente: "pass", botaoAceitarTodos: "pass", botaoRecusarOpcionais: "pass", temposLaboratorio: await p.evaluate(() => (window as JanelaQA).__qaTempos), limite: "Event Timing e longtasks desta fixture não são INP de campo nem medição causal do SDK real" });
  await c.close();

  const plataforma = await contexto(null);
  const publica = await plataforma.newPage();
  await publica.goto(`http://localhost:${porta}/ajuda`);
  await publica.waitForLoadState("networkidle");
  assert.equal(await publica.getByRole("dialog").count(), 0);
  await abrir(publica);
  await publica.getByRole("button", { name: "Fechar", exact: true }).click();
  resultados.push({ plataforma: "pass", autoPopup: false, rodapeManual: true });
  await plataforma.close();
  await writeFile(`${pasta}/resultado.json`, JSON.stringify({ status: "passed", commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, ambiente: "github-ci-loopback-postgresql", sdkRemotoExecutado: false, coletasReais: 0, bloqueadas, fixtures, resultados }, null, 2));
} catch (erro) {
  await writeFile(`${pasta}/falha.json`, JSON.stringify({ erro: String(erro), resultados }, null, 2));
  throw erro;
} finally {
  await navegador.close();
  servidor.kill("SIGTERM");
  if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
}
