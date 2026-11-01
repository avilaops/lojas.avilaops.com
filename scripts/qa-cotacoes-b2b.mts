import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/db.ts";
import { emitirToken, gerarHashSenha } from "../src/lib/sessao.ts";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita.ts";
import { registrarCheckCotacao } from "../tests/helpers/mlops-evidence.ts";

const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.CI, "true", "Jornada executada exclusivamente na CI.");
assert.ok(["127.0.0.1", "localhost"].includes(database.hostname) && database.port === "5548" && database.pathname.endsWith("_test"), "Banco isolado obrigatório.");
process.env.LOJAS_SECRET = "0".repeat(64); // Fixture local, nunca um segredo de produção.
const painel = "http://127.0.0.1:3097";
const loja = "http://localhost:3097";
const directory = "artifacts/b2b-browser";
let server: ChildProcess | undefined;
let stage = "preparar";
const screenshots: Array<{ file: string; sha256: string }> = [];
const privateValues: string[] = [process.env.LOJAS_SECRET, process.env.DATABASE_URL].filter((value): value is string => !!value);
let serverOutput = "";
const diagnostics: Array<{ type: string; detail: string }> = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function iniciar() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(3097, "127.0.0.1", resolve); });
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  server = spawn(process.execPath, [".next/standalone/server.js"], {
    detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: "true", NODE_ENV: "production", DATABASE_URL: process.env.DATABASE_URL,
      LOJAS_SECRET: process.env.LOJAS_SECRET, LOJAS_BASE_DOMAIN: "127.0.0.1", NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: "0.0.0.0", PORT: "3097", ROTINAS_AGENDADOR: "0" },
  });
  const collect = (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString("utf8")}`.slice(-24_000); };
  server.stdout?.on("data", collect);
  server.stderr?.on("data", collect);
  let failed = false;
  server.once("error", () => { failed = true; });
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    assert.ok(!failed && server.exitCode === null, "Serviço de teste encerrou antes de ficar pronto.");
    const response = await fetch(`${painel}/api/v1`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (response?.ok) return;
    await sleep(500);
  }
  throw new Error("Serviço de teste não ficou pronto no prazo.");
}

async function parar() {
  const owned = server;
  server = undefined;
  if (!owned?.pid) return;
  // O grupo foi criado por este runner; não encerramos processos descobertos por porta.
  try { process.kill(-owned.pid, "SIGTERM"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  const deadline = Date.now() + 10_000;
  while (owned.exitCode === null && owned.signalCode === null && Date.now() < deadline) await sleep(100);
  if (owned.exitCode === null && owned.signalCode === null) {
    try { process.kill(-owned.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    await new Promise<void>(resolve => owned.once("exit", () => resolve()));
  }
}

async function selecionar(page: Page, label: string, id: string) {
  await page.getByLabel(label, { exact: true }).locator(`option[value="${id}"]`).waitFor({ state: "attached" });
  await page.getByLabel(label, { exact: true }).selectOption(id);
}
async function comando(page: Page, name: string) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/cotacoes-b2b")),
    page.getByRole("button", { name, exact: true }).click(),
  ]);
  assert.ok(response.ok(), `Comando recusado: ${name}`);
}
async function capturar(page: Page, file: string) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "Interface com overflow horizontal.");
  await page.screenshot({ path: `${directory}/${file}`, fullPage: true, timeout: 10_000, animations: "disabled" });
  screenshots.push({ file, sha256: createHash("sha256").update(await readFile(`${directory}/${file}`)).digest("hex") });
}

await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  assert.equal(await prisma.tenant.count({ where: { dominios: { has: "localhost" } } }), 0, "Domínio de teste já utilizado.");
  const tenant = await prisma.tenant.create({ data: { slug: `qa-browser-${randomUUID()}`, nome: "Loja QA B2B", status: "ATIVA", dominios: ["localhost"], dominioPrincipal: "localhost", loginEmail: "vendas@example.test" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Indústria QA" } });
  const unidade = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" } });
  const senha = `qa-${randomUUID()}`;
  privateValues.push(senha);
  const conta = await prisma.comprador.create({ data: { tenantId: tenant.id, nome: "Comprador QA", email: `${randomUUID()}@example.test`, senhaHash: gerarHashSenha(senha) } });
  const comprador = await prisma.compradorEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorId: conta.id, nome: conta.nome, emailNormalizado: conta.email } });
  await prisma.escopoCompradorB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorEmpresaId: comprador.id, papel: "ADMINISTRADOR", escopo: "ORGANIZACAO", contextoVersao: 1 } });
  const produto = await salvarProdutoNoCatalogo(tenant.id, null, { nome: "Peça QA", slug: `peca-${randomUUID()}`, sku: `P-${randomUUID()}`, precoCentavos: 1500, estoque: 20, imagens: [] });
  const variante = await prisma.variante.findFirstOrThrow({ where: { tenantId: tenant.id, produtoId: produto.id } });
  stage = "iniciar";
  await iniciar();
  const merchant = await browser.newContext();
  const buyer = await browser.newContext();
  for (const context of [merchant, buyer]) {
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      return ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "3097" ? route.continue() : route.abort();
    });
  }
  const token = emitirToken(tenant.slug);
  privateValues.push(token);
  await merchant.addCookies([{ name: "lojas_sessao", value: token, url: painel, httpOnly: true, sameSite: "Lax" }]);
  assert.equal((await buyer.request.post(`${loja}/api/conta`, { data: { acao: "entrar", email: conta.email, senha } })).status(), 200);
  assert.equal((await (await buyer.request.get(`${loja}/api/conta`)).json()).logado, true);
  const anon = await browser.newContext();
  assert.equal((await anon.request.get(`${painel}/api/painel/cotacoes-b2b`)).status(), 401);
  await anon.close();
  stage = "contrato";
  const before = await prisma.cotacaoB2B.count({ where: { tenantId: tenant.id } });
  const validInput = { empresaId: empresa.id, unidadeId: unidade.id, compradorEmpresaId: comprador.id,
    responsavelEmail: "vendas@example.test", validaAte: "2099-12-01T12:00:00.000Z",
    itens: [{ produtoId: produto.id, varianteId: variante.id, quantidade: 1 }] };
  for (const data of [{}, { ...validInput, itens: [] }, { ...validInput, ator: { tipo: "COMPRADOR" } }, { ...validInput, campoDesconhecido: true }]) {
    assert.equal((await merchant.request.post(`${painel}/api/painel/cotacoes-b2b`, { data })).status(), 422);
  }
  assert.equal(await prisma.cotacaoB2B.count({ where: { tenantId: tenant.id } }), before);
  assert.equal((await merchant.request.get(`${painel}/api/painel/cotacoes-b2b/nao-existe`)).status(), 404);
  const references = await merchant.request.get(`${painel}/api/painel/cotacoes-b2b/referencias?tipo=empresas`);
  assert.equal(references.status(), 200);
  assert.ok((await references.json()).opcoes.some((option: { id: string }) => option.id === empresa.id));
  await registrarCheckCotacao("contrato", { assertions: { unauthenticatedRejected: true, invalidBodiesRejected: true, unknownFieldRejected: true, noWrite: true, missingQuoteRejected: true } });

  let ultimaCotacao = "";
  let ultimoPedido = "";
  for (const width of [1280, 390]) {
    stage = `jornada-${width}`;
    const sellerPage = await merchant.newPage();
    const buyerPage = await buyer.newPage();
    await sellerPage.setViewportSize({ width, height: 900 });
    await buyerPage.setViewportSize({ width, height: 900 });
    const pageErrors: string[] = [];
    for (const page of [sellerPage, buyerPage]) {
      page.setDefaultTimeout(120_000);
      page.on("pageerror", error => { pageErrors.push(error.name); diagnostics.push({ type: "pageerror", detail: error.message }); });
      page.on("console", message => { if (message.type() === "error") diagnostics.push({ type: "console", detail: message.text().slice(0, 800) }); });
      page.on("response", response => { if (response.url().includes("/cotacoes-b2b")) diagnostics.push({ type: "http", detail: `${response.status()} ${new URL(response.url()).pathname}` }); });
      page.on("requestfailed", request => diagnostics.push({ type: "network", detail: `${new URL(request.url()).pathname} ${request.failure()?.errorText}` }));
    }
    await sellerPage.goto(`${painel}/painel/cotacoes`);
    stage = `formulario-${width}`;
    await sellerPage.getByRole("button", { name: "Nova cotação", exact: true }).click();
    await sellerPage.getByRole("heading", { name: "Nova cotação", exact: true }).waitFor();
    stage = `empresa-${width}`;
    await selecionar(sellerPage, "Selecionar empresa", empresa.id);
    await selecionar(sellerPage, "Selecionar unidade", unidade.id);
    await selecionar(sellerPage, "Selecionar comprador", comprador.id);
    await sellerPage.getByLabel("Validade", { exact: true }).fill("2099-12-01T12:00");
    await selecionar(sellerPage, "Selecionar produto", variante.id);
    stage = `criacao-${width}`;
    await comando(sellerPage, "Criar cotação");
    await sellerPage.waitForURL(url => url.searchParams.has("cotacao"));
    ultimaCotacao = new URL(sellerPage.url()).searchParams.get("cotacao")!;
    await sellerPage.getByRole("button", { name: "Negociar", exact: true }).click();
    stage = `negociacao-${width}`;
    await sellerPage.getByRole("button", { name: "Remover item 1", exact: true }).click();
    await selecionar(sellerPage, "Selecionar produto", variante.id);
    await sellerPage.getByLabel("Quantidade do item 1", { exact: true }).fill("2");
    await sellerPage.getByLabel("Condições comerciais", { exact: true }).fill("Pagamento em 30 dias");
    await comando(sellerPage, "Salvar contraproposta");
    await sellerPage.getByText(/Versão 2 · Validade/).waitFor();
    assert.equal((await merchant.request.post(`${painel}/api/painel/cotacoes-b2b/${ultimaCotacao}`, { data: { acao: "submeter", versaoEsperada: 1 } })).status(), 409);
    await comando(sellerPage, "Enviar para aprovação");
    stage = `aprovacao-${width}`;
    const approval = await buyer.request.get(`${loja}/api/conta/cotacoes-b2b/${ultimaCotacao}`);
    assert.equal(approval.status(), 200);
    assert.equal((await approval.json()).estado, "AGUARDANDO_APROVACAO");
    await buyerPage.goto(`${loja}/conta/cotacoes?cotacao=${ultimaCotacao}`);
    await comando(buyerPage, "Aprovar cotação");
    await buyerPage.locator('section[aria-label="Detalhes da cotação"] strong').getByText("Aprovada", { exact: true }).waitFor();
    await capturar(buyerPage, `comprador-${width}.png`);
    await sellerPage.getByRole("button", { name: "Recarregar cotações", exact: true }).click();
    stage = `conversao-${width}`;
    await comando(sellerPage, "Converter em pedido");
    const link = sellerPage.getByRole("link", { name: /Abrir pedido #/ });
    await link.waitFor();
    await capturar(sellerPage, `vendedor-${width}.png`);
    await link.click();
    await sellerPage.waitForURL(/\/painel\/pedidos\//);
    const stored = await prisma.cotacaoB2B.findUniqueOrThrow({ where: { id: ultimaCotacao }, include: { pedido: { include: { itens: true } }, eventos: true } });
    assert.equal(stored.estado, "CONVERTIDA");
    assert.equal(stored.pedido?.empresaB2BId, empresa.id);
    assert.equal(stored.pedido?.unidadeB2BId, unidade.id);
    assert.equal(stored.pedido?.cotacaoVersao, 2);
    assert.equal(stored.pedido?.totalCentavos, 3000);
    assert.deepEqual(stored.pedido?.condicoesComerciais, { observacoes: "Pagamento em 30 dias" });
    assert.equal(stored.pedido?.itens[0].quantidade, 2);
    await sellerPage.getByRole("heading", { name: `Pedido #${stored.pedido!.numero}`, exact: true }).waitFor();
    await capturar(sellerPage, `pedido-${width}.png`);
    assert.deepEqual(pageErrors, []);
    ultimoPedido = stored.pedidoId!;
    await sellerPage.close(); await buyerPage.close();
  }
  await registrarCheckCotacao("jornada", { assertions: { desktopJourney: true, mobileJourney: true, buyerApproval: true, orderOpened: true, noHorizontalOverflow: true, noPageError: true }, metrics: { viewports: 2 } });
  stage = "reiniciar";
  await parar(); await iniciar();
  const response = await merchant.request.get(`${painel}/api/painel/cotacoes-b2b/${ultimaCotacao}`);
  assert.equal(response.status(), 200);
  const readback = await response.json();
  assert.equal(readback.estado, "CONVERTIDA");
  assert.equal(readback.pedido.id, ultimoPedido);
  assert.equal(readback.pedido.cotacaoVersao, 2);
  assert.equal(readback.pedido.empresaB2BId, empresa.id);
  assert.equal(readback.pedido.unidadeB2BId, unidade.id);
  assert.equal(readback.pedido.totalCentavos, 3000);
  assert.deepEqual(readback.pedido.condicoesComerciais, { observacoes: "Pagamento em 30 dias" });
  assert.deepEqual(readback.versoes.map((version: { numero: number }) => version.numero), [1, 2]);
  assert.ok(readback.eventos.some((event: { tipo: string }) => event.tipo === "CONVERTIDA"));
  const fresh = await merchant.newPage();
  await fresh.goto(`${painel}/painel/cotacoes?cotacao=${ultimaCotacao}`);
  await fresh.getByRole("link", { name: /Abrir pedido #/ }).waitFor({ timeout: 120_000 });
  await fresh.close();
  stage = "revogacao";
  const eventsBefore = await prisma.eventoCotacaoB2B.count({ where: { cotacaoId: ultimaCotacao, tenantId: tenant.id } });
  await prisma.escopoCompradorB2B.deleteMany({ where: { tenantId: tenant.id, compradorEmpresaId: comprador.id } });
  const revokedList = await buyer.request.get(`${loja}/api/conta/cotacoes-b2b`);
  assert.equal(revokedList.status(), 200);
  assert.deepEqual((await revokedList.json()).cotacoes, []);
  assert.equal((await buyer.request.get(`${loja}/api/conta/cotacoes-b2b/${ultimaCotacao}`)).status(), 404);
  assert.equal((await buyer.request.post(`${loja}/api/conta/cotacoes-b2b/${ultimaCotacao}`, { data: { acao: "cancelar", versaoEsperada: 2 } })).status(), 404);
  assert.equal(await prisma.eventoCotacaoB2B.count({ where: { cotacaoId: ultimaCotacao, tenantId: tenant.id } }), eventsBefore);
  assert.equal((await merchant.request.get(`${painel}/api/painel/cotacoes-b2b/${ultimaCotacao}`)).status(), 200);
  await registrarCheckCotacao("persistencia", { assertions: { freshHttpRead: true, serviceRestarted: true, orderPreserved: true, versionsPreserved: true, historyPreserved: true, freshPageRead: true } });
  assert.equal(serverOutput.includes("[rotina] agendador ligado"), false, "Agendador deve permanecer desligado no serviço isolado.");
  await writeFile(`${directory}/summary.json`, JSON.stringify({ status: "passed", environment: "local_isolated", screenshots }, null, 2));
  console.log("Jornada B2B desktop/celular, contrato HTTP e reinício: aprovados.");
} catch (error) {
  let index = 0;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    diagnostics.push({ type: "page", detail: `${new URL(page.url()).pathname}: ${(await page.locator("body").innerText({ timeout: 3000 }).catch(() => "Página indisponível")).slice(0, 2400)}` });
    await page.screenshot({ path: `${directory}/failure-${index++}.png`, fullPage: true, timeout: 5000 }).catch(() => undefined);
  }
  let message = error instanceof Error ? error.message : "Erro desconhecido";
  for (const value of privateValues) message = message.replaceAll(value, "[redacted]");
  let report = JSON.stringify({ status: "failed", stage, errorType: error instanceof Error ? error.name : "Unknown", message: message.slice(0, 2400), screenshots, diagnostics: diagnostics.slice(-80), serverOutput });
  for (const value of privateValues) report = report.replaceAll(value, "[redacted]");
  await writeFile(`${directory}/failure.json`, report);
  throw new Error(`Falha na verificação B2B, etapa ${stage}. Consulte os artefatos da CI.`);
} finally {
  try { await browser.close(); }
  finally {
    try { await parar(); }
    finally { await prisma.$disconnect(); }
  }
}
