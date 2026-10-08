/**
 * Valida cada template na prévia do painel, em vez de olhar e achar.
 *
 * Abre `/painel/previa?t=…` para os 12 layouts × 2 viewports × 2 modos × 2
 * preferências de movimento (96 casos), mede cada um e sai com 1 se algum
 * falhar. A matriz e o julgamento estão em `src/lib/validacao-templates.ts`,
 * presos em `npm test`; aqui fica só o que precisa de navegador.
 *
 *   SESSAO=<valor do cookie lojas_sessao> \
 *     npx tsx scripts/validar-templates.mts http://localhost:3099 [--so <layout>] [--retratos <dir>]
 *
 * Sem `SESSAO`, o script cria a loja `qa-validacao-templates` e emite o token
 * sozinho, mas só no banco de teste (`127.0.0.1|localhost:5548/*_test`, com o
 * mesmo `LOJAS_SECRET` do servidor). Em qualquer outro banco ele recusa.
 * `CHROMIUM=/caminho/chrome` aponta um navegador já instalado.
 *
 * Roteiro inteiro e como ler a saída: `docs/VALIDACAO-TEMPLATES.md`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { VALORES_LAYOUT } from "../src/lib/tema";
import { VIEWPORTS, avaliarMedida, casosDeValidacao, ePreCarregamentoDeLink, type MedidaDoCaso } from "../src/lib/validacao-templates";

const SAIDA = ".work/engineer/validacao-templates.json";
const SLUG_QA = "qa-validacao-templates";

const args = process.argv.slice(2);
/** Valor de `--nome <valor>`, tirando os dois de `args`. */
function opcao(nome: string): string | undefined {
  const i = args.indexOf(nome);
  if (i === -1) return undefined;
  const [, valor] = args.splice(i, 2);
  if (!valor || valor.startsWith("--")) sair(`${nome} pede um valor.`);
  return valor;
}

function sair(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

const SO = opcao("--so");
const RETRATOS = opcao("--retratos");
const BASE = args[0];

if (!BASE || args.length !== 1) {
  sair("uso: [SESSAO=<cookie>] npx tsx scripts/validar-templates.mts <base> [--so <layout>] [--retratos <dir>]");
}
// Só servidor local: com SESSAO, uma base de produção receberia o cookie de
// um lojista de verdade.
let HOST_BASE = "";
try {
  HOST_BASE = new URL(BASE).hostname;
} catch {
  sair(`${BASE}: não é um endereço.`);
}
if (!["127.0.0.1", "localhost"].includes(HOST_BASE)) {
  sair(`${BASE}: este script só roda contra localhost ou 127.0.0.1.`);
}
if (SO && !(VALORES_LAYOUT as string[]).includes(SO)) {
  sair(`--so ${SO}: layout desconhecido. Existem: ${VALORES_LAYOUT.join(", ")}.`);
}

/**
 * Sessão para a prévia. Sem `SESSAO`, só o banco de teste serve: é a mesma
 * guarda de `tests/integration/api-v1.test.ts`, e é o único lugar onde este
 * script grava.
 */
async function sessao(): Promise<string> {
  if (process.env.SESSAO) return process.env.SESSAO;
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    sair("Sem SESSAO e sem DATABASE_URL: passe o cookie em SESSAO ou aponte o banco de teste (:5548/*_test).");
  }
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
    sair("Sem SESSAO, este script só cria a loja de QA no banco isolado local :5548/*_test. Passe SESSAO ou aponte DATABASE_URL para ele.");
  }
  // Importados só aqui: com SESSAO o script não toca em banco nenhum.
  const { prisma } = await import("../src/lib/db");
  const { emitirToken } = await import("../src/lib/sessao");
  try {
    await prisma.tenant.upsert({
      where: { slug: SLUG_QA },
      create: { slug: SLUG_QA, nome: "QA Validação de Templates", status: "ATIVA" },
      update: { status: "ATIVA" },
    });
  } finally {
    await prisma.$disconnect();
  }
  return emitirToken(SLUG_QA);
}

// A medição vai como texto e não como função: o `tsx` compila com esbuild, que
// injeta helpers (`__name`) inexistentes dentro do navegador.
const MEDICAO = `(() => {
  const d = document.documentElement;
  const palco = document.querySelector("div[data-layout]");

  // Cor computada (rgb, color(), oklch…) → hex, pintando um pixel sobre a base.
  const hex = (cor, base) => {
    const tela = document.createElement("canvas");
    tela.width = tela.height = 1;
    const x = tela.getContext("2d", { willReadFrequently: true });
    x.fillStyle = base; x.fillRect(0, 0, 1, 1);
    x.fillStyle = cor; x.fillRect(0, 0, 1, 1);
    const p = x.getImageData(0, 0, 1, 1).data;
    return "#" + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const corpo = getComputedStyle(document.body);
  const corFundo = hex(corpo.backgroundColor, "#ffffff");
  const corTexto = hex(corpo.color, corFundo);

  const nome = (el) => (el.tagName + " " + String(el.getAttribute("class") || "").slice(0, 60)).trim();

  // Quem estica: o primeiro elemento do palco que passa da borda direita sem
  // estar cortado por um ancestral que rola ou esconde (trilho de carrossel).
  const cortado = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== "visible" && p.getBoundingClientRect().right <= d.clientWidth + 1) return true;
    }
    return false;
  };
  let vaza = d.scrollWidth - d.clientWidth;
  let culpado = null;
  if (vaza > 0 && palco) {
    for (const el of palco.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > d.clientWidth + 1 && !cortado(el)) { culpado = nome(el); break; }
    }
    // Só a faixa fixa da prévia passou: não é defeito do template.
    const faixa = document.querySelector('p[role="status"]');
    if (!culpado && faixa && faixa.getBoundingClientRect().right > d.clientWidth + 1) vaza = 0;
  }

  const dura = (texto) => texto.split(",").some((t) => parseFloat(t) > 0);
  let transicoes = 0;
  const exemplos = [];
  const conta = (rotulo) => { transicoes++; if (exemplos.length < 6) exemplos.push(rotulo); };
  if (palco) {
    for (const el of [palco, ...palco.querySelectorAll("*")]) {
      if (dura(getComputedStyle(el).transitionDuration)) conta(nome(el));
      for (const pseudo of ["::before", "::after"]) {
        const s = getComputedStyle(el, pseudo);
        if (s.content !== "none" && s.content !== "normal" && dura(s.transitionDuration)) conta(nome(el) + pseudo);
      }
    }
  }

  return {
    layoutDesenhado: palco ? palco.getAttribute("data-layout") : null,
    modoNoHtml: d.getAttribute("data-modo"),
    vazaLateralPx: vaza,
    culpado,
    corTexto,
    corFundo,
    animacoesAtivas: document.getAnimations().length,
    transicoesComDuracao: transicoes,
    exemplosDeTransicao: exemplos,
  };
})()`;

type Medido = Omit<MedidaDoCaso, "errosDePagina"> & { exemplosDeTransicao: string[] };

// Fontes carregadas e imagens do palco resolvidas (carregou ou quebrou): é o
// que muda largura e altura depois do `load`.
const ASSENTOU = `document.fonts.status === "loaded" && [...document.querySelectorAll("div[data-layout] img")].every((i) => i.complete || i.loading === "lazy")`;

/**
 * As imagens do tema de teste (`tests/fixtures/tema-premium-completo.json`)
 * não existem: uma está num host fictício, a outra em `/media/` de uma loja.
 * O script responde as duas com esta, senão o Automotivo Premium falharia por
 * endereço de teste e não por defeito do template. Endereço exato, sem
 * curinga: qualquer outra imagem quebrada, mesmo vizinha destas, reprova.
 */
const IMAGENS_DO_FIXTURE = new Set([
  "https://exemplo.test/editorial/acessorios.webp",
  new URL("/media/automotivo-premium/editorial-cuidado-v1.webp", BASE).href,
]);
const IMAGEM_NEUTRA = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#9ca3af"/></svg>';

async function main() {
  const temaPremium = JSON.parse(readFileSync(new URL("../tests/fixtures/tema-premium-completo.json", import.meta.url), "utf8")) as Record<string, unknown>;
  const casos = casosDeValidacao(temaPremium).filter((c) => !SO || c.layout === SO);
  const cookie = await sessao();
  if (RETRATOS) mkdirSync(RETRATOS, { recursive: true });

  const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const resultados: Array<{ id: string; passou: boolean; falhas: string[]; medida: MedidaDoCaso | null; exemplosDeTransicao: string[]; preCarregamentosIgnorados: number }> = [];

  try {
    // Um contexto por vez, em sequência: o servidor tem 4 GB.
    for (const caso of casos) {
      const movel = caso.viewport === "movel";
      const contexto = await navegador.newContext({
        viewport: VIEWPORTS[caso.viewport],
        isMobile: movel,
        hasTouch: movel,
        colorScheme: caso.modo === "escuro" ? "dark" : "light",
        reducedMotion: caso.movimento === "reduzido" ? "reduce" : "no-preference",
      });
      let falhas: string[];
      let medida: MedidaDoCaso | null = null;
      let exemplosDeTransicao: string[] = [];
      let preCarregamentosIgnorados = 0;
      try {
        await contexto.addCookies([{ name: "lojas_sessao", value: cookie, domain: HOST_BASE, path: "/" }]);
        await contexto.route(
          (url) => IMAGENS_DO_FIXTURE.has(url.href),
          (rota) => rota.fulfill({ contentType: "image/svg+xml", body: IMAGEM_NEUTRA }),
        );
        const pagina = await contexto.newPage();
        const errosDePagina: string[] = [];
        pagina.on("pageerror", (e) => errosDePagina.push(e.message));
        pagina.on("console", (m) => {
          if (m.type() !== "error") return;
          if (ePreCarregamentoDeLink(m.location().url, m.text())) preCarregamentosIgnorados++;
          else errosDePagina.push(`${m.text()} (${m.location().url})`);
        });
        // `load` e não `networkidle`: o Next não lê o corpo do 404 dos
        // pré-carregamentos, a requisição fica aberta e a rede nunca sossega.
        await pagina.goto(new URL(caso.caminho, BASE).href, { waitUntil: "load", timeout: 60_000 });
        await pagina.waitForFunction(ASSENTOU, undefined, { timeout: 30_000 });
        // Dá tempo de a hidratação terminar, de os pré-carregamentos voltarem
        // e de transição de entrada acabar.
        await pagina.waitForTimeout(1500);
        const { exemplosDeTransicao: exemplos, ...medido } = (await pagina.evaluate(MEDICAO)) as Medido;
        medida = { ...medido, errosDePagina };
        exemplosDeTransicao = exemplos;
        falhas = avaliarMedida(caso, medida);
        if (RETRATOS) await pagina.screenshot({ path: join(RETRATOS, `${caso.id}.png`) });
      } catch (e) {
        falhas = [`não foi possível medir: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`];
      } finally {
        await contexto.close();
      }
      const passou = falhas.length === 0;
      resultados.push({ id: caso.id, passou, falhas, medida, exemplosDeTransicao, preCarregamentosIgnorados });
      console.log(passou ? `ok      ${caso.id}` : `FALHOU  ${caso.id}\n${falhas.map((f) => `          · ${f}`).join("\n")}`);
    }
  } finally {
    await navegador.close();
  }

  const falharam = resultados.filter((r) => !r.passou);
  mkdirSync(".work/engineer", { recursive: true });
  writeFileSync(SAIDA, JSON.stringify({ base: BASE, quando: new Date().toISOString(), casos: resultados.length, passaram: resultados.length - falharam.length, falharam: falharam.length, resultados }, null, 2));

  console.log(`\n${resultados.length} casos · ${resultados.length - falharam.length} passaram · ${falharam.length} falharam`);
  console.log(`resultado completo: ${SAIDA}`);
  process.exit(falharam.length > 0 || resultados.length === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
