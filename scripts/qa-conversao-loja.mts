import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/db.ts";
import { salvarProdutoNoCatalogo, salvarGradeNoCatalogo } from "../src/lib/catalogo-escrita.ts";
import { contratoPadraoAninhado } from "../src/lib/contratos-comerciais.ts";
import { definirPadrao, salvarCredencial } from "../src/lib/credenciais.ts";
import { provedoresDePagamento } from "../src/lib/provedores-pagamento.ts";

const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.CI, "true");
assert.ok(["127.0.0.1", "localhost"].includes(banco.hostname) && banco.port === "5548" && banco.pathname.endsWith("_test"), "Banco isolado obrigatório");
const slug = `qa-conversao-${randomUUID().slice(0, 8)}`;
const origem = `http://${slug}.localhost:3098`;
const pasta = "artifacts/conversao-browser";
let servidor: ChildProcess | undefined;
let tenantId: string | undefined;
const relatorio: Array<Record<string, unknown>> = [];
const browser = await chromium.launch({ headless: true });
async function captura(page: Page, nome: string) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Overflow: ${nome}`);
  await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true, animations: "disabled" });
}

try {
  await mkdir(pasta, { recursive: true });
  const t = await prisma.tenant.create({ data: {
    slug, nome: "Automotiva QA", status: "ATIVA", plano: "LOJA", dominioPrincipal: `${slug}.localhost`, dominios: [`${slug}.localhost`],
    tema: { layout: "automotivo", categoriaSemImagem: "icone" }, recursos: ["pagamentos_pix_manual", "recebimento_v2"],
    retiradaNaLoja: true, enderecoPublico: true, despachoDiasUteis: 1,
    horario: "Segunda a sexta, das 9h às 18h",
    endereco: { logradouro: "Rua QA", numero: "100", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" },
    entregaLocal: [{ prefixos: ["14"], nome: "Entrega QA", preco: 1500, prazoDiasUteis: 2 }],
    contratosComerciais: { create: contratoPadraoAninhado("LOJA", { aceiteEm: null, aceiteReferencia: null, origem: "QA isolado" }) },
  } });
  tenantId = t.id;
  const categoria = await prisma.categoria.create({ data: { tenantId: t.id, slug: "kits", nome: "Kits Completos" } });
  await salvarProdutoNoCatalogo(t.id, null, { nome: "Kit lavagem QA", slug: "kit-qa", sku: "KIT-QA", precoCentavos: 5000, estoque: 30, categoriaId: categoria.id, imagens: [`${origem}/lojas-mark.svg`] });
  await salvarProdutoNoCatalogo(t.id, null, { nome: "Pano QA", slug: "pano-qa", sku: "PANO-QA", precoCentavos: 500, estoque: 4, categoriaId: categoria.id });
  await salvarProdutoNoCatalogo(t.id, null, { nome: "Esgotado QA", slug: "esgotado-qa", sku: "ESGOTADO-QA", precoCentavos: 500, estoque: 0, categoriaId: categoria.id });
  const comOpcoes = await salvarProdutoNoCatalogo(t.id, null, { nome: "Apresentação QA", slug: "apresentacao-qa", sku: "APRESENTACAO-QA", precoCentavos: 1000, estoque: 4, categoriaId: categoria.id });
  await salvarGradeNoCatalogo(t.id, comOpcoes.id, ["Volume"], [{ valores: { Volume: "500ml" }, precoCentavos: 1000, estoque: 4 }, { valores: { Volume: "1L" }, precoCentavos: 2000, estoque: 4 }]);
  const provedor = provedoresDePagamento.obter("pix_manual");
  const publicos = { chavePix: randomUUID(), nomeRecebedor: "QA sem pagamento real" };
  const teste = await provedor.testarConexao({ segredos: {}, publicos });
  assert.equal(teste.ok, true);
  const credencial = await salvarCredencial(t, "pix_manual", { segredos: {}, publicos }, teste);
  await definirPadrao(t, credencial.id);
  servidor = spawn(process.execPath, [".next/standalone/server.js"], { detached: true, stdio: "ignore", env: {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", CI: "true", HOSTNAME: "0.0.0.0", PORT: "3098",
    DATABASE_URL: process.env.DATABASE_URL, LOJAS_SECRET: process.env.LOJAS_SECRET, LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0",
  } });
  let pronto = false;
  for (let n = 0; n < 120; n++) {
    assert.equal(servidor.exitCode, null, "Servidor encerrou");
    if ((await fetch(`${origem}/api/v1`, { signal: AbortSignal.timeout(3000) }).catch(() => null))?.ok) { pronto = true; break; }
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(pronto, "Servidor QA não ficou pronto");
  for (const width of [390, 1440]) {
    const contexto = await browser.newContext({ viewport: { width, height: 900 } });
    const erros: string[] = [];
    // Só aplicação local e consulta de endereço com fixture; nunca chama gateway real.
    await contexto.route("**/*", async route => {
      const u = new URL(route.request().url());
      if (u.hostname === "viacep.com.br") return route.fulfill({ json: { cep: "14075-240", logradouro: "Rua QA", bairro: "Centro", localidade: "Ribeirão Preto", uf: "SP" } });
      return u.hostname === `${slug}.localhost` && u.port === "3098" ? route.continue() : route.abort();
    });
    const page = await contexto.newPage();
    page.on("pageerror", e => erros.push(e.message));
    await page.goto(origem);
    await page.getByRole("link", { name: "Ver kits disponíveis" }).waitFor();
    const consentimento = page.getByRole("button", { name: "Só o necessário", exact: true });
    if (await consentimento.isVisible()) await consentimento.click();
    await page.goto(`${origem}/produtos/kit-qa`);
    await page.getByLabel("CEP para calcular a entrega").fill("14075240");
    await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
    await page.getByText("Entrega QA", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("CPF ou CNPJ").count(), 0);
    await captura(page, `produto-${width}`);
    await page.getByRole("button", { name: "Adicionar ao carrinho: Kit lavagem QA", exact: true }).click();
    await page.waitForURL(/\/carrinho$/);
    await page.getByRole("button", { name: "Adicionar sugestão: Pano QA", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Esgotado QA", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Adicionar sugestão: Apresentação QA", exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Ver opções e detalhes", exact: true }).count(), 1);
    await page.getByRole("button", { name: "Adicionar sugestão: Pano QA", exact: true }).click();
    await page.getByText("Pano QA adicionado ao carrinho.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Adicionar sugestão: Pano QA", exact: true }).count(), 0);
    await captura(page, `sugestoes-${width}`);
    await page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Pano QA", exact: true }) }).getByRole("button", { name: "Remover", exact: true }).click();
    await page.getByLabel("CEP para calcular a entrega").fill("14075240");
    await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
    await page.getByText("Entrega QA", { exact: true }).waitFor();
    await page.getByRole("region", { name: "Calcule entrega e prazo", exact: true }).getByText("Rua QA, 100 · Centro · Ribeirão Preto - SP · 14010-000", { exact: false }).waitFor();
    await page.getByText("Aguarde a confirmação de que o pedido está pronto antes de ir à loja.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Mais", exact: true }).click();
    assert.equal(await page.getByText("Entrega QA", { exact: true }).count(), 0, "Quantidade nova invalida cotação");
    await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
    await page.getByText("Entrega QA", { exact: true }).waitFor();
    await captura(page, `carrinho-${width}`);
    await page.getByRole("link", { name: "Finalizar compra", exact: true }).click();
    await page.waitForURL(/\/checkout$/);
    await page.getByLabel("CEP para calcular a entrega").fill("14075240");
    await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
    await page.getByText("Entrega QA", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Nome", { exact: true }).inputValue(), "");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByText("Informe o seu nome.", { exact: true }).waitFor();
    await page.getByLabel("Nome", { exact: true }).fill("Maria");
    await page.getByLabel("Sobrenome", { exact: true }).fill("QA");
    await page.getByLabel("E-mail", { exact: true }).fill(`qa-${width}@example.test`);
    await page.getByLabel("Celular", { exact: true }).fill("16999999999");
    await page.getByLabel("CPF ou CNPJ", { exact: true }).fill("52998224725");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("CEP", { exact: true }).fill("14075240");
    await page.getByRole("radio", { name: /Entrega QA/ }).waitFor();
    await page.getByLabel("CEP", { exact: true }).fill("01001000");
    await page.getByRole("radio", { name: /Retirar na loja/ }).waitFor();
    // Esperar a consulta do novo CEP antes de provar a ausência da opção antiga.
    await page.getByRole("button", { name: "Continuar", exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".ck-actions .ck-btn--primary")?.disabled);
    assert.equal(await page.getByRole("radio", { name: /Entrega QA/ }).count(), 0);
    await page.getByRole("radio", { name: /Retirar na loja/ }).check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("heading", { name: "Como você prefere pagar", exact: true }).waitFor();
    await captura(page, `pagamento-${width}`);
    if (width === 1440) await page.route("**/api/checkout", async route => {
      // O servidor cria a cobrança de teste, mas o navegador perde a resposta.
      const resposta = await route.fetch();
      assert.ok(resposta.ok());
      await route.abort("failed");
    });
    await page.getByRole("button", { name: /Pagar R\$\s*100,00/ }).click();
    if (width === 1440) {
      await page.getByRole("heading", { name: "Estamos confirmando o pagamento", exact: true }).waitFor();
      assert.equal(await page.getByText(/Nada foi cobrado/).count(), 0);
      await page.reload();
      await page.getByRole("heading", { name: "Sua compra anterior já virou pedido", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: /^Pagar / }).count(), 0);
      assert.equal(await prisma.pedido.count({ where: { tenantId: t.id, clienteEmail: `qa-${width}@example.test` } }), 1);
      await captura(page, `resposta-perdida-${width}`);
    } else await page.getByRole("heading", { name: "Pague com Pix", exact: true }).waitFor();
    const pedido = await prisma.pedido.findFirstOrThrow({ where: { tenantId: t.id, clienteEmail: `qa-${width}@example.test` } });
    assert.equal(pedido.status, "AGUARDANDO_PAGAMENTO");
    assert.equal(pedido.totalCentavos, 10000);
    assert.equal(pedido.gateway, "pix_manual");
    assert.deepEqual(erros, []);
    relatorio.push({ width, cotacaoSemIdentidade: true, invalidaAoAlterarQuantidade: true, trocaCepSemCotacaoAntiga: true, pixGerado: true, respostaPerdidaSemRepetirCobranca: width === 1440, pagamentoReal: false });
    await contexto.close();
  }
  await writeFile(`${pasta}/resultado.json`, JSON.stringify({ commit: process.env.GITHUB_SHA, ambiente: "github-ci-postgresql-isolado", verificacoes: relatorio }, null, 2));
  console.log("Consulta de entrega e checkout desktop/mobile: aprovados sem pagamento real.");
} finally {
  await browser.close();
  if (servidor?.pid) {
    const encerrado = new Promise<void>(resolve => servidor!.once("exit", () => resolve()));
    try { process.kill(-servidor.pid, "SIGTERM"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
    await Promise.race([encerrado, new Promise(r => setTimeout(r, 5000))]);
  }
  if (tenantId) await prisma.$transaction(async tx => {
    // O banco conserva reservas e movimentos por variante com RESTRICT.
    // A fixture é isolada; limpar os registros pertencentes a ela primeiro.
    await tx.reservaEstoque.deleteMany({ where: { tenantId } });
    await tx.movimentoEstoque.deleteMany({ where: { tenantId } });
    await tx.tentativaCatalogo.deleteMany({ where: { tenantId } });
    await tx.pedido.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
  await prisma.$disconnect();
}
