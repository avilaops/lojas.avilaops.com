/**
 * Mede uma tela do painel num iPhone de verdade, em vez de olhar e achar.
 *
 * Irmão do `medir-mobile.mts`, que mede a vitrine. Aqui as perguntas são
 * outras, porque quem usa o painel é o lojista trabalhando no balcão:
 *
 *   - **quantas telas de rolagem** a página tem (a de produto tinha 4,9);
 *   - **se a página vaza de lado** — um nome técnico longo estica a grade e
 *     come o respiro da direita, e o defeito só aparece com dado real;
 *   - **quais alvos de toque** ficam abaixo dos 44px da Apple.
 *
 * O painel exige sessão, então o cookie vai por ambiente:
 *
 *   SESSAO=<valor do cookie lojas_sessao> \
 *     npx tsx scripts/medir-painel.mts http://localhost:3080/painel/produtos/<id>
 *
 * O cookie sai do navegador já logado, ou de `emitirToken(slug)`
 * (src/lib/sessao.ts) num banco de desenvolvimento. `CHROMIUM=/caminho/chrome`
 * aponta um navegador já instalado, para máquina onde o download do Playwright
 * não passa.
 */
import { chromium, devices } from "playwright";

const ALVO = process.argv[2];
const RETRATO = process.argv[3];
const SESSAO = process.env.SESSAO;

if (!ALVO || !SESSAO) {
  console.error("uso: SESSAO=<cookie> npx tsx scripts/medir-painel.mts <url> [retrato.png]");
  process.exit(1);
}

/** iPhone 14 Pro: o aparelho de quem abre o painel no balcão. */
const APARELHO = devices["iPhone 14 Pro"];
const { hostname } = new URL(ALVO);

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const contexto = await navegador.newContext({ ...APARELHO });
await contexto.addCookies([{ name: "lojas_sessao", value: SESSAO, domain: hostname, path: "/" }]);
const pagina = await contexto.newPage();
await pagina.goto(ALVO, { waitUntil: "networkidle", timeout: 60_000 });
// O formulário do painel chega por fetch depois da primeira pintura.
await pagina.waitForTimeout(1500);

// A medição vai como texto e não como função: o `tsx` compila com esbuild, que
// injeta helpers (`__name`) inexistentes dentro do navegador.
const medida = await pagina.evaluate(`(() => {
  const d = document.documentElement;
  const vaza = d.scrollWidth - d.clientWidth;

  // Quem estica: o primeiro elemento que passa da borda direita.
  let culpado = null;
  if (vaza > 0) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > d.clientWidth + 1) {
        culpado = el.tagName + " " + String(el.className || "").slice(0, 60);
        break;
      }
    }
  }

  const pequenos = [];
  for (const el of document.querySelectorAll("a, button, summary, select, input, textarea")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 44) pequenos.push(Math.round(r.height) + "px · " + ((el.textContent || "").trim().slice(0, 28) || el.tagName));
  }

  // Campo escondido em bloco fechado não conta como tela: é o que a
  // reorganização de Produtos comprou.
  const campos = [...document.querySelectorAll("input, select, textarea")];
  const aberto = campos.filter((c) => c.getBoundingClientRect().height > 0 && !c.closest("details:not([open])"));

  return {
    alturaPx: Math.round(d.scrollHeight),
    telasDeRolagem: +(d.scrollHeight / window.innerHeight).toFixed(1),
    vazaLateralPx: vaza,
    culpado,
    campos: campos.length,
    camposAbertos: aberto.length,
    alvosPequenos: pequenos.length,
    exemplos: pequenos.slice(0, 6),
  };
})()`);

console.log(JSON.stringify(medida, null, 2));
if (RETRATO) await pagina.screenshot({ path: RETRATO });
await navegador.close();
