import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db.ts";
import { emitirToken } from "../src/lib/sessao.ts";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita.ts";

assert.equal(process.env.CI, "true", "Verificação exclusiva do GitHub CI");
const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(banco.hostname) && banco.port === "5548" && banco.pathname.endsWith("_test"), "Banco isolado obrigatório");
const sufixo = randomUUID().slice(0, 8);
const porta = "3115";
const origem = `http://localhost:${porta}`;
const pasta = "artifacts/seo-descoberta-browser";
const ids: string[] = [];
const resultados: Array<Record<string, unknown>> = [];
const erros: string[] = [];
const servidor = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, PORT: porta, HOSTNAME: "0.0.0.0", LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0", SSO_APP_ID: "", LOJAS_OIDC_CLIENT_ID: "", LOJAS_OIDC_CLIENT_SECRET: "", PLATAFORMA_GTM_ID: "" },
  stdio: "inherit",
});
const navegador = await chromium.launch({ headless: true });

async function pedir(slug: string, caminho: string) {
  return fetch(origem + caminho, { redirect: "manual", headers: { host: "backend.example", "x-forwarded-host": `${slug}.localhost` } });
}

async function patch(token: string | null, body: unknown) {
  return fetch(origem + "/api/painel/loja", { method: "PATCH", headers: { "content-type": "application/json", origin: origem, ...(token ? { cookie: `lojas_sessao=${token}` } : {}) }, body: JSON.stringify(body) });
}

async function contexto(token: string) {
  const c = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  await c.addCookies([{ name: "lojas_sessao", value: token, url: origem }]);
  await c.route("**/*", r => new URL(r.request().url()).hostname === "localhost" ? r.continue() : r.abort());
  return c;
}

try {
  await mkdir(pasta, { recursive: true });
  const alfa = await prisma.tenant.create({ data: { slug: `qa-seo-alfa-${sufixo}`, nome: "Loja Alfa QA", slogan: "Equipamentos para sua empresa", status: "ATIVA" } });
  ids.push(alfa.id);
  const beta = await prisma.tenant.create({ data: { slug: `qa-seo-beta-${sufixo}`, nome: "Loja Beta QA", slogan: "Outra loja de exemplo", status: "ATIVA" } });
  ids.push(beta.id);
  for (const numero of [1, 2]) await salvarProdutoNoCatalogo(alfa.id, null, { nome: `Referência Alfa ${numero}`, slug: `referencia-alfa-${numero}`, destaque: true, precoCentavos: numero * 1000 }, { origem: "qa-seo" });
  await salvarProdutoNoCatalogo(beta.id, null, { nome: "Referência Beta", slug: "referencia-beta", destaque: true, precoCentavos: 3000 }, { origem: "qa-seo" });
  const operador = await prisma.operadorLoja.create({ data: { tenantId: alfa.id, nome: "Operador QA", email: `operador-${sufixo}@example.test`, senhaHash: "fixture", papel: "OPERADOR" } });
  let pronto = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origem + "/api/health")).ok) { pronto = true; break; } } catch { /* aguarda o servidor compilado */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(pronto, "Aplicação compilada iniciou");
  assert.equal((await patch(null, { configuracaoSeo: {} })).status, 401);
  const token = emitirToken(alfa.slug);
  const tokenOperador = emitirToken(alfa.slug, operador.id);
  assert.equal((await patch(tokenOperador, { configuracaoSeo: { tituloInicio: "Tentativa sem permissão" } })).status, 403);
  assert.equal((await patch(token, { configuracaoSeo: { limiteDestaques: 999 } })).status, 422);

  const inicial = await (await pedir(alfa.slug, "/")).text();
  const tituloAutomatico = `${alfa.nome} • ${alfa.slogan}`;
  assert.ok(inicial.includes(`<title>${tituloAutomatico}</title>`));
  assert.equal(((await (await pedir(alfa.slug, "/llms.txt")).text()).match(/\/produtos\/referencia-alfa-[12]\)/g) ?? []).length, 2);
  const dono = await contexto(token);
  const page = await dono.newPage();
  page.on("pageerror", e => erros.push(e.message));
  await page.goto(origem + "/painel/configuracoes/descoberta", { waitUntil: "domcontentloaded" });
  await page.locator('[data-seo-lojas="1"]').waitFor();
  assert.equal(await page.getByLabel("Título da página inicial", { exact: true }).inputValue(), "");
  const titulo = "Loja Alfa • Equipamentos e soluções";
  const descricao = "Encontre equipamentos e soluções para sua empresa na Loja Alfa. Compare referências, consulte o catálogo e fale com a equipe para escolher com orientação.";
  await page.getByLabel("Título da página inicial", { exact: true }).fill(titulo);
  await page.getByLabel("Descrição da página inicial", { exact: true }).fill(descricao);
  assert.equal(await page.locator("[data-seo-previa-titulo]").innerText(), titulo);
  assert.ok((await (await pedir(alfa.slug, "/")).text()).includes(`<title>${tituloAutomatico}</title>`), "Prévia não grava antes do salvar");
  await page.getByLabel("Incluir produtos de destaque no resumo", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Alterações salvas." }).waitFor();
  const publicada = await (await pedir(alfa.slug, "/")).text();
  assert.ok(publicada.includes(`<title>${titulo}</title>`), "Título absoluto sem duplicar a marca");
  assert.ok(publicada.includes(`name="description" content="${descricao}"`));
  const resumo = await (await pedir(alfa.slug, "/llms.txt")).text();
  assert.doesNotMatch(resumo, /\/produtos\/referencia-alfa-/);
  assert.ok(resumo.includes("/produtos") && resumo.includes("/llms-full.txt"), "Apenas destaques saem do resumo");
  assert.equal((await pedir(alfa.slug, "/llms-full.txt")).status, 200);
  assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: alfa.id } })).permiteTreinamentoIa, false);
  resultados.push({ caso: "formulario_previa_home_resumo", passou: true });

  assert.equal((await patch(token, { configuracaoSeo: { incluirDestaques: true, limiteDestaques: 1 } })).status, 200);
  assert.equal(((await (await pedir(alfa.slug, "/llms.txt")).text()).match(/\/produtos\/referencia-alfa-[12]\)/g) ?? []).length, 1);
  const tituloAtualizado = "Loja Alfa • Catálogo profissional";
  const descricaoAtualizada = "Conheça o catálogo profissional da Loja Alfa. Encontre referências para sua empresa e conte com orientação para escolher os equipamentos da sua operação.";
  const concorrentes = await Promise.all([
    patch(token, { configuracaoSeo: { tituloInicio: tituloAtualizado } }),
    patch(token, { configuracaoSeo: { descricaoInicio: descricaoAtualizada } }),
  ]);
  assert.ok(concorrentes.every(r => r.status === 200));
  const config = (await prisma.tenant.findUniqueOrThrow({ where: { id: alfa.id } })).configuracaoSeo as Record<string, unknown>;
  assert.equal(config.tituloInicio, tituloAtualizado);
  assert.equal(config.descricaoInicio, descricaoAtualizada);
  assert.equal(config.limiteDestaques, 1);
  assert.equal((await patch(token, { slug: beta.slug, configuracaoSeo: { tituloInicio: tituloAtualizado } })).status, 200);
  assert.deepEqual((await prisma.tenant.findUniqueOrThrow({ where: { id: beta.id } })).configuracaoSeo, {});
  assert.ok((await (await pedir(beta.slug, "/")).text()).includes(`<title>${beta.nome} • ${beta.slogan}</title>`));
  assert.ok(!(await (await pedir(beta.slug, "/llms.txt")).text()).includes(alfa.slug));
  resultados.push({ caso: "merge_limite_isolamento_permissao", passou: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-seo-lojas="1"]').waitFor();
  for (const width of [1440, 393]) {
    // Cada captura começa sem o histórico de rolagem e foco do formulário.
    const captura = await dono.newPage();
    captura.on("pageerror", e => erros.push(e.message));
    await captura.setViewportSize({ width, height: 1000 });
    await captura.goto(origem + "/painel/configuracoes/descoberta", { waitUntil: "networkidle" });
    await captura.locator('[data-seo-lojas="1"]').waitFor();
    const posicao = await captura.evaluate(() => ({ topo: window.scrollY, largura: window.innerWidth, conteudo: document.documentElement.scrollWidth }));
    console.log(JSON.stringify({ capturaSeo: width, ...posicao }));
    assert.equal(posicao.topo, 0, "Captura começa no topo");
    assert.ok(posicao.conteudo <= posicao.largura + 1, "Painel sem rolagem horizontal");
    await captura.screenshot({ path: `${pasta}/painel-${width}.png`, fullPage: true, animations: "disabled" });
    await captura.close();
  }
  await page.getByRole("button", { name: "Usar título e descrição automáticos", exact: true }).click();
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Alterações salvas." }).waitFor();
  assert.ok((await (await pedir(alfa.slug, "/")).text()).includes(`<title>${tituloAutomatico}</title>`));
  const consulta = await contexto(tokenOperador);
  const paginaConsulta = await consulta.newPage();
  await paginaConsulta.goto(origem + "/painel/configuracoes/descoberta", { waitUntil: "domcontentloaded" });
  assert.ok(await paginaConsulta.getByLabel("Título da página inicial", { exact: true }).isDisabled());
  assert.ok(await paginaConsulta.getByRole("button", { name: "Salvar alterações", exact: true }).isDisabled());
  await consulta.close();
  await dono.close();
  assert.deepEqual(erros, []);
  resultados.push({ caso: "desktop_mobile_automatico_consulta", passou: true });
  await writeFile(`${pasta}/evidence.json`, JSON.stringify({ passou: true, resultados, erros }, null, 2));
  console.log(JSON.stringify({ seoDescoberta: resultados, erros }));
} finally {
  await navegador.close();
  servidor.kill();
  await prisma.eventoCatalogo.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}
