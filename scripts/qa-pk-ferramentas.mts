import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/db.ts";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita.ts";

assert.equal(process.env.CI, "true", "Verificação exclusiva da CI");
const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["127.0.0.1", "localhost"].includes(banco.hostname) && banco.port === "5548" && banco.pathname.endsWith("_test"), "Banco isolado obrigatório");
const porta = "3097";
const origem = `http://pkvedacoes.localhost:${porta}`;
const outraSlug = `qa-pk-outra-${randomUUID().slice(0, 8)}`;
const outraOrigem = `http://${outraSlug}.localhost:${porta}`;
const pasta = "artifacts/pk-ferramentas-browser";
const tenants: string[] = [];
const resultados: Array<Record<string, unknown>> = [];
let servidor: ChildProcess | undefined;
let ultimaPagina: Page | undefined;
const browser = await chromium.launch({ headless: true });
async function captura(page: Page, nome: string) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Sem overflow: ${nome}`);
  await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true, animations: "disabled" });
}

try {
  await mkdir(pasta, { recursive: true });
  assert.equal(await prisma.tenant.findUnique({ where: { slug: "pkvedacoes" } }), null, "Fixture PK deve nascer em banco CI sem loja PK existente");
  const pk = await prisma.tenant.create({ data: { slug: "pkvedacoes", nome: "PK Vedações QA", status: "ATIVA", plano: "SITE", dominioPrincipal: "pkvedacoes.localhost", dominios: ["pkvedacoes.localhost"], tema: { layout: "industrial" } } });
  tenants.push(pk.id);
  const outra = await prisma.tenant.create({ data: { slug: outraSlug, nome: "Outra loja QA", status: "ATIVA", plano: "SITE" } });
  tenants.push(outra.id);
  const categoria = await prisma.categoria.create({ data: { tenantId: pk.id, slug: "gaxeta-pu-tipo-bs", nome: "Gaxeta PU tipo BS" } });
  const produtos = [];
  for (let i = 0; i < 4; i++) produtos.push(await salvarProdutoNoCatalogo(pk.id, null, {
    nome: `Gaxeta BS QA ${i + 1}`, slug: `gaxeta-bs-qa-${i + 1}`, sku: `PKQA${i + 1}`, precoCentavos: i === 0 ? 0 : 1250 + i * 100, estoque: 10, categoriaId: categoria.id,
    descricao: "Produto exclusivo da verificação CI.", atributos: { diametroInternoMm: 20 + i, diametroExternoMm: 30 + i, alturaMm: 4, secaoMm: 2, material: "Poliuretano (PU)", perfil: "BS", aplicacao: "Haste" },
  }));
  const alheio = await salvarProdutoNoCatalogo(outra.id, null, { nome: "Produto exclusivo de outra loja", slug: "produto-alheio-qa", sku: "FORA-PK", precoCentavos: 100, estoque: 3 });
  servidor = spawn(process.execPath, [".next/standalone/server.js"], { detached: true, stdio: "inherit", env: { ...process.env, NODE_ENV: "production", HOSTNAME: "0.0.0.0", PORT: porta, LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0", SSO_APP_ID: "" } });
  let pronto = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(servidor.exitCode, null, "Servidor deve permanecer ativo");
    if ((await fetch(`http://localhost:${porta}/api/v1`, { signal: AbortSignal.timeout(3000), headers: { "x-forwarded-host": "pkvedacoes.localhost" } }).catch(() => null))?.ok) { pronto = true; break; }
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(pronto, "Servidor standalone iniciou");
  for (const width of [390, 1440]) {
    const contexto = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    await contexto.route("**/*", route => [origem, outraOrigem].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    await contexto.addInitScript(() => localStorage.setItem("loja_consentimento", JSON.stringify({ escolha: "essencial", versao: 1 })));
    const page = await contexto.newPage();
    ultimaPagina = page;
    const erros: string[] = [];
    page.on("pageerror", e => erros.push(e.message));
    page.setDefaultTimeout(15_000);
    assert.equal((await page.goto(origem))?.status(), 200);
    await page.getByRole("heading", { name: "Vedar, retirar sujeira e apoiar o movimento", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Perfis e detalhes dos produtos", exact: true }).waitFor();
    await captura(page, `home-beneficios-${width}`);
    await page.getByRole("radio", { name: /Tenho a peça usada/ }).check();
    await page.getByRole("link", { name: "Aprender a medir", exact: true }).waitFor();
    await page.getByRole("radio", { name: /Conheço a aplicação/ }).check();
    await page.getByRole("link", { name: "Explorar aplicações", exact: true }).waitFor();
    await page.getByRole("link", { name: "Ver o caminho completo", exact: true }).click();
    await page.waitForURL("**/como-escolher");
    assert.equal(new URL(page.url()).pathname, "/como-escolher");
    await page.getByRole("heading", { level: 1, name: "Da dúvida sobre a peça à cotação bem identificada.", exact: true }).waitFor();
    assert.ok((await page.locator('link[rel="canonical"]').getAttribute("href"))?.endsWith("/como-escolher"));
    const codigo = page.getByRole("radio", { name: /Tenho um código/ });
    await codigo.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("radio", { name: /Tenho a peça usada/ }).isChecked(), true);
    await page.getByRole("link", { name: "Aprender a medir", exact: true }).waitFor();
    await page.getByRole("radio", { name: /Conheço a aplicação/ }).check();
    await page.getByRole("link", { name: "Explorar aplicações", exact: true }).waitFor();
    const segmentos = page.getByRole("region", { name: "Aplicações organizadas por finalidade", exact: true });
    assert.equal(await segmentos.getByRole("link").count(), 10);
    for (const grupo of ["Produzir", "Cultivar", "Construir", "Movimentar", "Sustentar a infraestrutura"]) assert.equal(await segmentos.getByRole("heading", { name: grupo, exact: true }).count(), 1);
    await captura(page, `jornada-visual-${width}`);
    await page.getByRole("radio", { name: /Tenho a peça usada/ }).check();
    await page.getByRole("link", { name: "Aprender a medir", exact: true }).click();
    await page.waitForURL("**/guias/medir-vedacoes");
    assert.equal(new URL(page.url()).pathname, "/guias/medir-vedacoes");
    for (const documento of [
      { caminho: "/guias/medir-vedacoes", trecho: /medida nominal|diâmetro|paquímetro/i, nome: "guia-medidas" },
      { caminho: "/guias/perfis-b-bs-std", trecho: /êmbolo ou haste/, nome: "guia-perfis" },
      { caminho: "/aplicacoes/agricultura", trecho: /cilindro|trator|agrícola/i, nome: "segmento-agricultura" },
    ]) {
      const resposta = await page.goto(`${origem}${documento.caminho}`);
      assert.equal(resposta?.status(), 200);
      await page.locator("article .prosa h2").first().waitFor();
      assert.match(await page.locator("article .prosa").innerText(), documento.trecho, "MDX renderiza conteúdo técnico além do título");
      // O motor de texto do Playwright ignora <script>; examine o JSON-LD diretamente.
      await page.waitForFunction(() => [...document.querySelectorAll('script[type="application/ld+json"]')].some(el => {
        try { return (JSON.parse(el.textContent ?? "{}")["@graph"] ?? []).some((item: { "@type"?: string }) => item["@type"] === "Article"); }
        catch { return false; }
      }));
      await captura(page, `${documento.nome}-${width}`);
    }
    await page.goto(`${origem}/produtos/${produtos[0].slug}`);
    await page.getByRole("heading", { name: "Características", exact: true }).waitFor();
    assert.equal(await page.getByText("Esquema dimensional", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("img", { name: /Diâmetro interno:/ }).count(), 0);
    const ficha = await page.locator(".ficha-tecnica").innerText();
    assert.match(ficha, /Diâmetro interno/);
    assert.match(ficha, /20 mm/);
    assert.match(ficha, /30 mm/);
    assert.match(ficha, /4 mm/);
    assert.match(ficha, /Poliuretano \(PU\)/);
    assert.match(await page.getByText("Função e seleção", { exact: true }).locator("..").innerText(), /vedação da haste/);
    await captura(page, `ficha-sem-esquema-${width}`);
    await page.goto(`${origem}/produtos`);
    for (const produto of produtos.slice(0, 3)) {
      const selecionar = page.getByRole("button", { name: `Comparar: ${produto.nome}`, exact: true });
      await selecionar.click();
      await page.getByRole("button", { name: `Remover da comparação: ${produto.nome}`, exact: true }).waitFor();
    }
    await page.getByRole("button", { name: `Comparar: ${produtos[3].nome}`, exact: true }).click();
    await page.getByText("Compare até 3 produtos. Remova um para continuar.", { exact: true }).waitFor();
    await captura(page, `catalogo-selecao-${width}`);
    await page.locator('a[href="/comparar"]').first().click();
    await page.getByRole("link", { name: "Atualizar comparação com a seleção", exact: true }).click();
    await page.getByRole("columnheader").filter({ hasText: produtos[0].nome }).waitFor();
    assert.equal(new URL(page.url()).searchParams.getAll("produto").length, 3);
    assert.match(await page.locator("main table").innerText(), /Poliuretano \(PU\)/);
    await captura(page, `comparador-${width}`);
    const respostaAlheio = await page.goto(`${origem}/comparar?produto=${alheio.slug}`);
    assert.equal(respostaAlheio?.status(), 200);
    assert.equal(await page.locator("main").getByText(alheio.nome, { exact: true }).count(), 0);
    await page.goto(`${origem}/cotacao-lote`);
    await page.getByLabel("Importar arquivo CSV").setInputFiles({ name: "lista-qa.csv", mimeType: "text/csv", buffer: Buffer.from("código;quantidade\nPKQA1;2\nPKQA2;3\nFORA-PK;1") });
    const respostaCotacao = page.waitForResponse(r => r.url().endsWith("/api/pk/cotacao-lote") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Conferir lista", exact: true }).click();
    const httpCotacao = await respostaCotacao;
    assert.equal(httpCotacao.status(), 200);
    const dados = await httpCotacao.json();
    assert.equal(dados.itens[0].estado, "consulta-preco");
    assert.equal(dados.itens[1].produtos[0].slug, produtos[1].slug);
    assert.equal(dados.itens[2].estado, "nao-encontrado");
    await page.getByRole("heading", { name: "Revise sua cotação", exact: true }).waitFor();
    const baixar = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar conferência em CSV", exact: true }).click();
    const download = await baixar;
    const destinoCsv = `${pasta}/cotacao-${width}.csv`;
    await download.saveAs(destinoCsv);
    assert.match(await readFile(destinoCsv, "utf8"), /PKQA1/);
    assert.match(await readFile(destinoCsv, "utf8"), /Não encontrado/);
    assert.equal(await prisma.pedido.count({ where: { tenantId: pk.id } }), 0);
    await captura(page, `cotacao-csv-${width}`);
    for (const caminho of ["/guias", "/aplicacoes/agricultura", "/comparar", "/cotacao-lote", "/como-escolher"]) {
      assert.equal((await page.goto(`${outraOrigem}${caminho}`))?.status(), 404, `Ferramenta PK isolada: ${caminho}`);
    }
    // Cliente HTTP Node usa localhost; cabeçalhos reproduzem o host resolvido pelo proxy.
    const baseHttp = `http://localhost:${porta}`;
    const cabecalhosPk = { "x-forwarded-host": new URL(origem).host, origin: origem };
    const cabecalhosOutra = { "x-forwarded-host": new URL(outraOrigem).host, origin: outraOrigem };
    assert.equal((await contexto.request.post(`${baseHttp}/api/pk/cotacao-lote`, { data: { itens: [{ codigo: "PKQA1", quantidade: 1 }] }, headers: cabecalhosOutra })).status(), 404);
    assert.equal((await contexto.request.post(`${baseHttp}/api/pk/demandas`, { data: { consulta: "nome@email.com", consentido: true }, headers: cabecalhosPk })).status(), 422);
    assert.equal((await contexto.request.post(`${baseHttp}/api/pk/demandas`, { data: { consulta: "PK998877", consentido: true }, headers: cabecalhosOutra })).status(), 404);
    assert.deepEqual(erros, [], "Sem erros JavaScript na jornada");
    resultados.push({ width, jornadaTresEntradasTeclado: "pass", mapaDezSegmentos: "pass", mdxGuiasSetores: "pass", fichaSemEsquema: "pass", limiteComparacao: "pass", comparacaoEntrePaginas: "pass", cotacaoApiRealCsv: "pass", isolamentoTenant: "pass", semPedidos: true });
    await contexto.close();
    ultimaPagina = undefined;
  }
  await writeFile(`${pasta}/resultado.json`, JSON.stringify({ commit: process.env.GITHUB_SHA, ambiente: "github-ci-postgresql-isolado", resultados }, null, 2));
} catch (erro) {
  await ultimaPagina?.screenshot({ path: `${pasta}/falha.png`, fullPage: true }).catch(() => undefined);
  await writeFile(`${pasta}/falha.json`, JSON.stringify({ commit: process.env.GITHUB_SHA, erro: erro instanceof Error ? erro.message : String(erro), resultados }, null, 2));
  throw erro;
} finally {
  await browser.close();
  if (servidor?.pid) {
    const encerrado = new Promise<void>(resolve => servidor!.once("exit", () => resolve()));
    try { process.kill(-servidor.pid, "SIGTERM"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
    await Promise.race([encerrado, new Promise(r => setTimeout(r, 5000))]);
  }
  for (const tenantId of tenants.reverse()) await prisma.$transaction(async tx => {
    await tx.reservaEstoque.deleteMany({ where: { tenantId } });
    await tx.movimentoEstoque.deleteMany({ where: { tenantId } });
    await tx.tentativaCatalogo.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
  await prisma.$disconnect();
}
