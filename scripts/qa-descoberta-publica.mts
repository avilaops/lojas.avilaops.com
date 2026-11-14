import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { PrismaClient, type Tenant } from "@prisma/client";
import type { FerramentaPublica } from "@avilaops/publicacao-texto/descoberta/navegador";

assert.equal(process.env.CI, "true", "Verificação exclusiva do GitHub CI");
const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["127.0.0.1", "localhost"].includes(banco.hostname) && banco.port === "5548" && banco.pathname.endsWith("_test"), "Banco isolado obrigatório");
const prisma = new PrismaClient();
const sufixo = randomUUID().slice(0, 8);
const porta = "3111";
const origem = `http://127.0.0.1:${porta}`;
const pasta = "artifacts/descoberta-publica-browser";
const uploads = resolve(pasta, `uploads-${sufixo}`);
const criadas: string[] = [];
const resultados: Array<Record<string, unknown>> = [];
const servidor = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, PORT: porta, HOSTNAME: "0.0.0.0", UPLOADS_DIR: uploads, LOJAS_STORAGE_URL: "", LOJAS_STORAGE_TOKEN: "", LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0", SSO_APP_ID: "", LOJAS_OIDC_CLIENT_ID: "", LOJAS_OIDC_CLIENT_SECRET: "" },
  stdio: "inherit",
});
const navegador = await chromium.launch({ headless: true });

function pedir(host: string, caminho: string) {
  return fetch(origem + caminho, { redirect: "manual", headers: { host: "backend-render.example", "x-forwarded-host": host } });
}

try {
  await mkdir(pasta, { recursive: true });
  const lojas: Tenant[] = [];
  for (const [cor, status] of [["azul", "ATIVA"], ["verde", "ATIVA"], ["privada", "PROVISIONANDO"], ["encerrada", "CANCELADA"]] as const) {
    const slug = `qa-descoberta-${cor}-${sufixo}`;
    const loja = await prisma.tenant.create({ data: {
      slug,
      nome: `Loja ${cor} QA`,
      status,
      logoUrl: `/uploads/${slug}/marca.png`,
      slogan: cor === "azul" ? "Marca </script><script>globalThis.__schemaExecutou=true</script>" : `Conteúdo público ${cor}.`,
    } });
    criadas.push(loja.id);
    lojas.push(loja);
  }
  await mkdir(`${uploads}/${lojas[0].slug}`, { recursive: true });
  await writeFile(`${uploads}/${lojas[0].slug}/marca.png`, await sharp({ create: { width: 16, height: 16, channels: 4, background: "#123456" } }).png().toBuffer());
  let pronto = false;
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    try { if ((await fetch(origem + "/api/health")).ok) { pronto = true; break; } } catch { /* aguarda o runtime da CI */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(pronto, "Aplicação compilada iniciou");

  for (const loja of lojas.slice(0, 2)) {
    const host = `${loja.slug}.localhost`;
    const html = await (await pedir(host, "/")).text();
    const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
    const organizacao = scripts.find((item) => item?.["@id"] === `https://${host}/#organization`);
    assert.equal(organizacao.image, `https://${host}/opengraph-image`);
    if (loja.id === lojas[0].id) {
      assert.equal(organizacao.logo, `https://${host}${loja.logoUrl}`);
      const logo = await pedir(host, loja.logoUrl!);
      assert.equal(logo.status, 200);
      assert.match(logo.headers.get("content-type") ?? "", /^image\/png/);
    } else assert.equal(Object.hasOwn(organizacao, "logo"), false, "Objeto inexistente não é anunciado como logo");
    const previa = await pedir(host, "/opengraph-image");
    assert.equal(previa.status, 200);
    assert.match(previa.headers.get("content-type") ?? "", /^image\/png/);
    assert.doesNotMatch(previa.headers.get("x-robots-tag") ?? "", /noindex/i);
    const bytes = Buffer.from(await previa.arrayBuffer());
    assert.equal(bytes.readUInt32BE(16), 1200);
    assert.equal(bytes.readUInt32BE(20), 630);
    for (const caminho of ["/.well-known/ard.json", "/ai-catalog.json"]) {
      const resposta = await pedir(host, caminho);
      assert.equal(resposta.status, 200, `${host}${caminho}`);
      assert.match(resposta.headers.get("content-type") ?? "", /^application\/json/);
      assert.match(resposta.headers.get("cache-control") ?? "", /private.*no-store/);
      assert.match(resposta.headers.get("vary") ?? "", /X-Forwarded-Host/);
      const dados = await resposta.json();
      if (caminho === "/ai-catalog.json") assert.equal(dados.specVersion, "1.0");
      assert.ok(dados.entries.some((entrada: { displayName: string }) => entrada.displayName === loja.nome));
      assert.ok(dados.entries.every((entrada: { url: string; representativeQueries: string[] }) => new URL(entrada.url).origin === `https://${host}` && entrada.representativeQueries.length >= 2 && entrada.representativeQueries.length <= 5));
      assert.ok(!JSON.stringify(dados).includes(lojas.find((outra) => outra.id !== loja.id)?.slug ?? "SENTINELA"), "Não mistura tenants entre requisições consecutivas");
      for (const entrada of dados.entries as Array<{ url: string; type: string }>) {
        const recurso = await pedir(host, new URL(entrada.url).pathname);
        assert.equal(recurso.status, 200, `Recurso anunciado existe: ${entrada.url}`);
        assert.ok((recurso.headers.get("content-type") ?? "").startsWith(entrada.type), `MIME anunciado: ${entrada.url}`);
      }
    }
    resultados.push({ host, ard: "pass", catalogoCompativel: "pass", recursosPublicos: "pass", imagemOg: "200-png-1200x630", logo: loja.id === lojas[0].id ? "existente" : "ausente-omitido" });
  }
  for (const caminho of ["/.well-known/ard.json", "/ai-catalog.json"]) {
    const resposta = await pedir("localhost", caminho);
    assert.equal(resposta.status, 200, "Plataforma não é reescrita para uma rota inexistente");
    const texto = await resposta.text();
    const dados = JSON.parse(texto);
    assert.ok(dados.entries.some((entrada: { url: string }) => entrada.url === "https://localhost/ajuda"));
    assert.ok(dados.entries.every((entrada: { url: string }) => new URL(entrada.url).hostname === "localhost"));
    assert.doesNotMatch(texto, /qa-descoberta-|\/painel|\/entrar|\/criar/);
    for (const host of [`qa-desconhecida-${sufixo}.localhost`, ...lojas.slice(2).map((loja) => `${loja.slug}.localhost`)]) {
      const recusa = await pedir(host, caminho);
      assert.equal(recusa.status, 404);
      assert.match(recusa.headers.get("cache-control") ?? "", /no-store/);
      assert.doesNotMatch(await recusa.text(), /Loja azul|Loja verde|entries/);
    }
  }
  resultados.push({ plataforma: "pass", hostDesconhecido: "404", lojaNaoPublicada: "404", lojaCancelada: "404" });

  for (const modo of ["atual", "anterior", "ausente"] as const) {
    const contexto = await navegador.newContext();
    await contexto.route("**/*", (rota) => {
      const host = new URL(rota.request().url()).hostname;
      return host === "localhost" || host.endsWith(".localhost") ? rota.continue() : rota.abort();
    });
    await contexto.addInitScript(({ modo }) => {
      const ferramentas: Record<string, FerramentaPublica> = {};
      Object.defineProperty(window, "__ferramentasPublicas", { value: ferramentas });
      Object.defineProperty(document, "modelContext", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "modelContext", { value: undefined, configurable: true });
      if (modo === "ausente") return;
      const modelContext = {
        registerTool(ferramenta: FerramentaPublica, opcoes?: { signal?: AbortSignal }) {
          if (ferramentas[ferramenta.name]) throw new Error("Ferramenta duplicada");
          ferramentas[ferramenta.name] = ferramenta;
          opcoes?.signal?.addEventListener("abort", () => { delete ferramentas[ferramenta.name]; }, { once: true });
        },
        unregisterTool(nome: string) { delete ferramentas[nome]; },
      };
      Object.defineProperty(modo === "atual" ? document : navigator, "modelContext", { value: modelContext });
    }, { modo });
    const pagina = await contexto.newPage();
    const erros: string[] = [];
    pagina.on("pageerror", (erro) => erros.push(erro.message));
    const base = `http://${lojas[0].slug}.localhost:${porta}`;
    await pagina.goto(base);
    await pagina.getByRole("heading", { level: 1 }).first().waitFor();
    await pagina.waitForLoadState("networkidle");
    assert.equal(await pagina.locator('link[rel="ard"]').getAttribute("href"), "/.well-known/ard.json");
    assert.equal(await pagina.evaluate(() => "__schemaExecutou" in globalThis), false, "Texto cadastrado não fecha o script JSON-LD");
    const schema = await pagina.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? "null")));
    const organizacao = schema.find((item) => item?.["@id"]?.endsWith("/#organization"));
    assert.equal(organizacao.image, `https://${lojas[0].slug}.localhost/opengraph-image`);
    assert.equal(organizacao.logo, `https://${lojas[0].slug}.localhost${lojas[0].logoUrl}`);
    const nomes = () => pagina.evaluate(() => Object.keys((window as unknown as { __ferramentasPublicas: Record<string, FerramentaPublica> }).__ferramentasPublicas).sort());
    if (modo === "ausente") {
      assert.deepEqual(await nomes(), []);
    } else {
      await pagina.waitForFunction(() => Object.keys((window as unknown as { __ferramentasPublicas: Record<string, FerramentaPublica> }).__ferramentasPublicas).length === 2);
      assert.deepEqual(await nomes(), ["consultar_pagina_publica", "localizar_links_publicos"]);
      const leitura = await pagina.evaluate(async () => {
        const ferramentas = (window as unknown as { __ferramentasPublicas: Record<string, FerramentaPublica> }).__ferramentasPublicas;
        return { pagina: await ferramentas.consultar_pagina_publica.execute({}), links: await ferramentas.localizar_links_publicos.execute({ consulta: "produtos", limite: 10 }), leitura: Object.values(ferramentas).every((ferramenta) => ferramenta.annotations.readOnlyHint) };
      });
      assert.ok(leitura.leitura);
      assert.match(JSON.stringify(leitura.pagina), /Loja azul QA/);
      assert.ok(JSON.stringify(leitura.links).includes("/produtos"));
      await pagina.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      assert.deepEqual(await nomes(), [], "Duração da página termina as ferramentas");
    }
    for (const caminho of ["/carrinho", "/checkout", "/conta", "/produtos?q=consulta-particular", "/nao-encontrado"]) {
      await pagina.goto(base + caminho);
      await pagina.waitForLoadState("networkidle");
      assert.deepEqual(await nomes(), [], `${modo}: ${caminho} fora do adaptador público`);
      assert.equal(await pagina.locator('meta[name="descoberta-publica"]').count(), 0);
    }
    await contexto.addCookies([{ name: "loja_conta", value: "sessao-nao-publicavel", url: base }]);
    await pagina.goto(base);
    await pagina.waitForLoadState("networkidle");
    assert.deepEqual(await nomes(), [], "Requisição com cookie de conta não instala ferramentas");
    await contexto.clearCookies();
    await pagina.goto(`http://localhost:${porta}/ajuda`);
    await pagina.waitForLoadState("networkidle");
    if (modo !== "ausente") await pagina.waitForFunction(() => Object.keys((window as unknown as { __ferramentasPublicas: Record<string, FerramentaPublica> }).__ferramentasPublicas).length === 2);
    for (const caminho of ["/entrar", "/criar", "/autorizar", "/painel"]) {
      await pagina.goto(`http://localhost:${porta}${caminho}`);
      await pagina.waitForLoadState("networkidle");
      assert.deepEqual(await nomes(), [], `Plataforma: ${caminho} fora do adaptador público`);
    }
    assert.deepEqual(erros, [], `Sem erros de JavaScript na API ${modo}`);
    resultados.push({ navegador: modo, leituraPublica: "pass", rotasPrivadas: "excluidas", sessao: "excluida" });
    await contexto.close();
  }

  const propria = await prisma.tenant.update({ where: { id: lojas[1].id }, data: { dominioPrincipal: `verde-${sufixo}.example`, dominios: [`verde-${sufixo}.example`] } });
  assert.equal((await pedir(`${propria.slug}.localhost`, "/.well-known/ard.json")).status, 404, "Alias noindex não publica descoberta");
  const canonica = await pedir(`verde-${sufixo}.example`, "/.well-known/ard.json");
  assert.equal(canonica.status, 200);
  assert.ok((await canonica.json()).entries.every((entrada: { url: string }) => new URL(entrada.url).hostname === `verde-${sufixo}.example`));
  resultados.push({ aliasNaoCanonico: "404", dominioProprio: "pass" });
  await writeFile(`${pasta}/resultado.json`, JSON.stringify({ commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, tentativa: process.env.GITHUB_RUN_ATTEMPT, ambiente: "github-ci-isolado", resultados }, null, 2));
} finally {
  await navegador.close();
  servidor.kill("SIGTERM");
  await prisma.tenant.deleteMany({ where: { id: { in: criadas } } });
  await prisma.$disconnect();
  await rm(uploads, { recursive: true, force: true });
}
