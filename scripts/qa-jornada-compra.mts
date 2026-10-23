var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";
import { definirPadrao, salvarCredencial } from "../src/lib/credenciais";
import { provedoresDePagamento } from "../src/lib/provedores-pagamento";
const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (banco.hostname !== "127.0.0.1" || banco.port !== "5548" || !banco.pathname.endsWith("_test")) {
  throw new Error("A jornada exige o banco isolado local 127.0.0.1:5548/*_test.");
}
process.env.LOJAS_SECRET ??= "0".repeat(64);
const destino = "output/vedashow-avl-265/jornada-compra";
const slug = `vedashow-qa-${Date.now()}`;
const origem = `http://${slug}.localhost:3080`;
const nomeProduto = "Retentor QA 25 \xD7 40 \xD7 7 mm";
const errosDoNavegador = [];
async function acessibilidade(page, etapa) {
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  await page.addScriptTag({ content: axe });
  const resultado = await page.evaluate(async () => {
    const axeNoNavegador = window.axe;
    const auditoria = await axeNoNavegador.run(document, { resultTypes: ["violations"] });
    return { overflowHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth, falhasAcessibilidadeSerias: auditoria.violations.filter((violacao) => violacao.impact === "critical" || violacao.impact === "serious").map((violacao) => ({ id: violacao.id, alvos: violacao.nodes.map((node) => node.target), resumo: violacao.nodes.map((node) => node.failureSummary ?? "") })) };
  });
  return { etapa, url: page.url(), ...resultado };
}
__name(acessibilidade, "acessibilidade");
async function prepararTenant() {
  const tenant = await prisma.tenant.create({ data: { slug, nome: "VedaShow \xB7 ensaio local", status: "ATIVA", plano: "LOJA", recursos: ["pagamentos_pix_manual", "recebimento_v2"], retiradaNaLoja: true, enderecoPublico: true, endereco: { logradouro: "Rua do Ensaio", numero: "100", bairro: "Centro", cidade: "Ribeir\xE3o Preto", uf: "SP", cep: "14010000" }, whatsapp: "5516999999999", identidade: { tituloHero: "Encontre a pe\xE7a pela medida ou refer\xEAncia", subtituloHero: "Cat\xE1logo t\xE9cnico para manuten\xE7\xE3o industrial." } } });
  const categoria = await prisma.categoria.create({ data: { tenantId: tenant.id, slug: "retentores", nome: "Retentores", ordem: 1 } });
  const produto = await salvarProdutoNoCatalogo(tenant.id, null, { nome: nomeProduto, slug: "retentor-qa-25-40-7", sku: "RET-QA-254007", categoriaId: categoria.id, marca: "Marca QA", precoCentavos: 4590, estoque: 3, imagens: [`${origem}/lojas-mark.svg`], descricaoCurta: "Pe\xE7a fict\xEDcia criada somente para validar a jornada local.", atributos: { diametroInternoMm: 25, diametroExternoMm: 40, alturaMm: 7, perfil: "TC", material: "NBR", unidade: "unidade", referencia: "RET-QA-254007" } });
  await salvarProdutoNoCatalogo(tenant.id, null, { nome: "Rolamento QA 6204 2RS", slug: "rolamento-qa-6204-2rs", sku: "ROL-QA-6204", marca: "Outra marca QA", precoCentavos: 3290, estoque: 2, imagens: [`${origem}/lojas-mark.svg`] });
  const definicao = provedoresDePagamento.obter("pix_manual");
  const publicos = { chavePix: "123e4567-e12b-12d1-a456-426655440000", nomeRecebedor: "VedaShow QA" };
  const teste = await definicao.testarConexao({ segredos: {}, publicos });
  assert.equal(teste.ok, true, teste.mensagem);
  const credencial = await salvarCredencial(tenant, "pix_manual", { segredos: {}, publicos }, teste);
  await definirPadrao(tenant, credencial.id);
  return { tenant, produto };
}
__name(prepararTenant, "prepararTenant");
async function main() {
  await mkdir(destino, { recursive: true });
  const { tenant, produto } = await prepararTenant();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/home/avops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (erro) => errosDoNavegador.push(erro.message));
  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") errosDoNavegador.push(mensagem.text());
  });
  const telas = [];
  await page.goto(`${origem}/produtos`, { waitUntil: "domcontentloaded", timeout: 6e4 });
  await page.getByRole("searchbox", { name: "Buscar produtos" }).waitFor();
  await page.waitForTimeout(750);
  await page.getByRole("searchbox", { name: "Buscar produtos" }).fill("RET-QA-254007");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.waitForLoadState("domcontentloaded");
  assert.match(page.url(), /q=RET-QA-254007/);
  await page.getByText("1 produto encontrado").waitFor();
  await page.getByText(/Filtros e ordem/).click();
  await page.getByRole("checkbox", { name: "S\xF3 dispon\xEDveis" }).check();
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.waitForLoadState("domcontentloaded");
  assert.match(page.url(), /disponivel=1/);
  await page.waitForTimeout(750);
  telas.push(await acessibilidade(page, "busca-e-filtro"));
  await page.screenshot({ path: `${destino}/01-busca-filtro-mobile.png`, fullPage: true });
  await Promise.all([page.waitForURL(/\/produtos\/retentor-qa-25-40-7/), page.getByRole("link", { name: new RegExp(nomeProduto) }).first().click()]);
  await page.getByText("Di\xE2metro interno", { exact: true }).waitFor();
  assert.equal(await page.getByText("25 mm", { exact: true }).count() > 0, true);
  await Promise.all([page.waitForURL((url) => url.pathname === "/produtos" && url.searchParams.get("q") === "RET-QA-254007"), page.getByRole("link", { name: "Voltar aos resultados" }).click()]);
  assert.match(page.url(), /q=RET-QA-254007/);
  await Promise.all([page.waitForURL(/\/produtos\/retentor-qa-25-40-7/), page.getByRole("link", { name: new RegExp(nomeProduto) }).first().click()]);
  await page.getByRole("button", { name: new RegExp(`Adicionar ao carrinho: ${nomeProduto}`) }).click();
  await page.goto(`${origem}/carrinho`, { waitUntil: "domcontentloaded", timeout: 6e4 });
  await page.getByText(nomeProduto, { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 6e4 });
  await page.getByText(nomeProduto, { exact: true }).waitFor();
  telas.push(await acessibilidade(page, "carrinho-persistente"));
  await page.screenshot({ path: `${destino}/02-carrinho-mobile.png`, fullPage: true });
  await Promise.all([page.waitForURL(/\/checkout$/), page.getByRole("link", { name: "Finalizar compra" }).click()]);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Informe o seu nome.").waitFor();
  await page.getByLabel("Nome", { exact: true }).fill("Maria");
  await page.getByLabel("Sobrenome").fill("Silva");
  await page.getByLabel("E-mail").fill("maria@example.test");
  await page.getByLabel("Celular").fill("16999999999");
  await page.getByLabel("CPF ou CNPJ").fill("52998224725");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Como voc\xEA quer receber").waitFor();
  await page.getByRole("radio", { name: /Retirar na loja/ }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Como voc\xEA prefere pagar").waitFor();
  telas.push(await acessibilidade(page, "frete-e-pagamento"));
  await page.screenshot({ path: `${destino}/03-pagamento-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: /Pagar R\$ 45,90/ }).click();
  await page.getByRole("heading", { name: "Pague com Pix" }).waitFor();
  telas.push(await acessibilidade(page, "pix-gerado"));
  await page.screenshot({ path: `${destino}/04-pix-gerado-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "J\xE1 paguei" }).click();
  await page.getByRole("heading", { name: "Pix avisado, em confer\xEAncia" }).waitFor();
  telas.push(await acessibilidade(page, "confirmacao-enviada"));
  await page.screenshot({ path: `${destino}/05-confirmacao-enviada-mobile.png`, fullPage: true });
  const pedido = await prisma.pedido.findFirstOrThrow({ where: { tenantId: tenant.id }, orderBy: { criadoEm: "desc" } });
  assert.equal(pedido.status, "AGUARDANDO_PAGAMENTO");
  assert.equal(pedido.pagamentoStatus, "aguardando_confirmacao");
  assert.equal(pedido.totalCentavos, 4590);
  assert.equal(pedido.gateway, "pix_manual");
  const cobranca = await prisma.cobrancaPixManual.findUniqueOrThrow({ where: { referencia: pedido.referencia } });
  assert.notEqual(cobranca.informadoEm, null);
  assert.equal(await page.evaluate((chave) => localStorage.getItem(chave), `loja:${slug}:carrinho`), "[]");
  assert.deepEqual(errosDoNavegador, []);
  for (const tela of telas) {
    assert.equal(tela.overflowHorizontal, false, `${tela.etapa}: overflow horizontal`);
    assert.deepEqual(tela.falhasAcessibilidadeSerias, [], `${tela.etapa}: viola\xE7\xF5es s\xE9rias do axe`);
  }
  const evidencia = { tenant: { id: tenant.id, slug }, produto: { id: produto.id, nome: nomeProduto }, pedido: { id: pedido.id, status: pedido.status, pagamentoStatus: pedido.pagamentoStatus, totalCentavos: pedido.totalCentavos, gateway: pedido.gateway }, verificacoes: { buscaPorSku: true, filtroDisponibilidade: true, retornoPreservaConsulta: true, carrinhoPersistiuAposReload: true, errosDeFormularioExibidos: true, freteRetiradaSelecionado: true, pixGeradoSemPagamentoReal: true, confirmacaoEnviadaParaConferencia: true, carrinhoLimpoAposPedido: true }, telas, errosDoNavegador };
  await writeFile(`${destino}/resultado.json`, `${JSON.stringify(evidencia, null, 2)}
`, "utf8");
  await browser.close();
  console.log(JSON.stringify(evidencia, null, 2));
}
__name(main, "main");
main().finally(() => prisma.$disconnect());
