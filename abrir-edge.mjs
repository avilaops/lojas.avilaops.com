/**
 * Abre o Edge no perfil dedicado da casa (~/.avilaops/navegador) e fica parado
 * ate a janela fechar, para o Nicolas logar a mao uma vez.
 *
 * Por que nao o perfil normal do Edge: o Chromium recusa automatizar o perfil
 * padrao ("DevTools remote debugging requires a non-default data directory").
 * E trava do navegador, nao permissao concedivel. Dai o perfil separado.
 *
 * Ao fechar, mostra quantos cookies ficaram gravados: perfil sem cookie de
 * facebook.com significa login incompleto, e o MCP vai cair na tela de login.
 */
import { chromium } from "playwright";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PERFIL = join(homedir(), ".avilaops", "navegador");
const ALVO = process.argv[2] || "https://business.facebook.com/";

const ctx = await chromium.launchPersistentContext(PERFIL, {
  channel: "msedge",
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const pagina = ctx.pages()[0] ?? (await ctx.newPage());
await pagina.goto(ALVO, { waitUntil: "domcontentloaded" }).catch(() => {});
console.log("janela aberta:", pagina.url());
console.log("perfil:", PERFIL);
console.log("faca o login e feche a janela quando terminar.");

// O contexto fechado nao responde mais cookies(), entao a contagem e amostrada
// enquanto a janela vive; a ultima amostra e a que vale no fim.
let ultimaAmostra = 0;
const amostrar = setInterval(async () => {
  const cookies = await ctx.cookies().catch(() => null);
  if (cookies) ultimaAmostra = cookies.filter((c) => /facebook|instagram|meta/.test(c.domain)).length;
}, 3000);

function encerrar() {
  clearInterval(amostrar);
  const banco = join(PERFIL, "Default", "Network", "Cookies");
  console.log(`cookies da Meta: ${ultimaAmostra}`);
  console.log(`banco de cookies: ${existsSync(banco) ? statSync(banco).size + " bytes" : "nao criado"}`);
  console.log(ultimaAmostra ? "login gravado." : "SEM login: repita e conclua a autenticacao.");
}

const limite = setTimeout(
  async () => {
    console.log("20 minutos: encerrando.");
    encerrar();
    await ctx.close().catch(() => {});
  },
  20 * 60 * 1000,
);

ctx.on("close", async () => {
  clearTimeout(limite);
  encerrar();
  process.exit(0);
});
