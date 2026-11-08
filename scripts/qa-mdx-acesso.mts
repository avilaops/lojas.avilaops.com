import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

assert.equal(process.env.CI, "true", "Verificação exclusiva da CI");
const origem = "http://localhost:3099";
const pasta = "artifacts/mdx-acesso-browser";
const servidor = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, PORT: "3099", HOSTNAME: "0.0.0.0", LOJAS_BASE_DOMAIN: "localhost", ROTINAS_AGENDADOR: "0", SSO_APP_ID: "" },
  stdio: "inherit",
});
const browser = await chromium.launch({ headless: true });
const resultados: Array<Record<string, unknown>> = [];
try {
  await mkdir(pasta, { recursive: true });
  let pronto = false;
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    try { if ((await fetch(`${origem}/ajuda`)).ok) { pronto = true; break; } } catch { /* aguarda o servidor */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(pronto, "Aplicação compilada iniciou");
  for (const largura of [360, 768, 1440]) {
    const contexto = await browser.newContext({ viewport: { width: largura, height: 900 } });
    // A página é local; nenhuma integração ou rastreador externo pode ser chamado.
    await contexto.route("**/*", (route) => new URL(route.request().url()).origin === origem ? route.continue() : route.abort());
    const page = await contexto.newPage();
    const erros: string[] = [];
    page.on("pageerror", (erro) => erros.push(erro.message));
    const resposta = await page.goto(`${origem}/ajuda`);
    assert.equal(resposta?.status(), 200);
    await page.getByRole("heading", { level: 1, name: "Seu próximo passo começa aqui." }).waitFor();
    const indice = page.getByRole("navigation", { name: "Capítulos da ajuda" });
    assert.equal(await indice.getByRole("link").count(), 7);
    for (const id of ["criar", "marca", "categorias", "produtos", "publicar", "pedidos", "erros"]) {
      assert.equal(await page.locator(`article section#${id}`).count(), 1);
    }
    await indice.getByRole("link", { name: "7. Erros comuns e como resolver" }).click();
    assert.equal(new URL(page.url()).hash, "#erros");
    const topo = await page.locator("#erros").evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(topo >= 70 && topo < 300, `Âncora visível abaixo do cabeçalho: ${topo}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Sem overflow a ${largura}px`);
    await page.screenshot({ path: `${pasta}/ajuda-${largura}.png`, fullPage: true, animations: "disabled" });
    await page.goto(`${origem}/entrar/equipe`);
    assert.equal(new URL(page.url()).pathname, "/entrar", "Acesso sem autorização continua bloqueado");
    assert.deepEqual(erros, [], "Sem erros de JavaScript");
    resultados.push({ largura, ajuda: "pass", ancoras: "pass", semAutorizacao: "redirect" });
    await contexto.close();
  }
  await writeFile(`${pasta}/resultado.json`, JSON.stringify({ commit: process.env.GITHUB_SHA, ambiente: "github-ci-isolado", resultados }, null, 2));
} finally {
  await browser.close();
  servidor.kill("SIGTERM");
}
