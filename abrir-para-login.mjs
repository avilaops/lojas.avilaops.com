/**
 * Abre o Chromium no perfil persistente da casa e fica parado, para o Nicolas
 * logar a mao. O login fica gravado em ~/.avilaops/navegador e o Playwright MCP
 * reabre autenticado nas proximas vezes.
 *
 * Fecha sozinho quando ele fechar a janela, ou em 20 minutos.
 */
import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

const PERFIL = join(homedir(), ".avilaops", "navegador");
const ALVO = process.argv[2] || "https://business.facebook.com/";

const ctx = await chromium.launchPersistentContext(PERFIL, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const pagina = ctx.pages()[0] ?? (await ctx.newPage());
await pagina.goto(ALVO, { waitUntil: "domcontentloaded" }).catch(() => {});
console.log("janela aberta em", ALVO);
console.log("perfil:", PERFIL);
console.log("faca o login e feche a janela quando terminar.");

const limite = setTimeout(
  () => {
    console.log("20 minutos sem fechar: encerrando.");
    ctx.close().catch(() => {});
  },
  20 * 60 * 1000,
);

ctx.on("close", () => {
  clearTimeout(limite);
  console.log("janela fechada, sessao gravada no perfil.");
  process.exit(0);
});
