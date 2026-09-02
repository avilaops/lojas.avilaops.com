/**
 * Mede a vitrine num iPhone de verdade, em vez de olhar e achar.
 *
 * A pergunta que ele responde é uma só: **quanto o comprador precisa rolar até
 * ver o primeiro produto com preço?** Num catálogo B2B esse número é a diferença
 * entre a loja ser usada e ser abandonada, e é fácil piorá-lo sem perceber ao
 * mexer no tema.
 *
 *   npx tsx scripts/medir-mobile.mts https://fenix.avilaops.com
 */
import { chromium, devices } from "playwright";

const ALVO = process.argv[2] ?? "https://fenix.avilaops.com";

/** iPhone 14 Pro: é o aparelho do Nicolas e o padrão de `auditoria-mobile-ios`. */
const APARELHO = devices["iPhone 14 Pro"];

async function main() {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ ...APARELHO });
  const pagina = await contexto.newPage();
  await pagina.goto(ALVO, { waitUntil: "networkidle", timeout: 60_000 });

  const alturaTela = APARELHO.viewport.height;

  // A medição vai como texto e não como função: o `tsx` compila com esbuild, que
  // injeta helpers (`__name`) inexistentes dentro do navegador, e a avaliação
  // quebraria antes de medir qualquer coisa.
  const medida = (await pagina.evaluate(`(() => {
    const alturaDe = (s) => {
      const e = document.querySelector(s);
      return e ? Math.round(e.getBoundingClientRect().height) : null;
    };
    const topo = (s) => {
      const e = document.querySelector(s);
      return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null;
    };

    // O primeiro cartão de produto da página, seja de que seção for.
    const primeiroProduto = topo(".cartao-produto");

    // Rolagem horizontal na página inteira é defeito: nada pode vazar.
    const vazaLargura = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    // Alvo de toque menor que 44px é abaixo do mínimo da Apple.
    const pequenos = [];
    for (const el of document.querySelectorAll("a, button")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 44) {
        const rotulo = (el.textContent || "").trim().slice(0, 28) || el.getAttribute("aria-label") || "";
        pequenos.push(Math.round(r.height) + "px · " + rotulo);
      }
    }

    const h1 = document.querySelector("h1");

    return {
      primeiroProduto,
      cabecalho: alturaDe("header.cabecalho-loja"),
      h1: alturaDe("h1"),
      tamanhoH1: h1 ? getComputedStyle(h1).fontSize : null,
      abertura: alturaDe(".mercado-abertura, .vitrine-hero, .home-abertura"),
      alturaTotal: Math.round(document.documentElement.scrollHeight),
      vazaLargura,
      pequenos: Array.from(new Set(pequenos)).slice(0, 12),
    };
  })()`)) as {
    primeiroProduto: number | null;
    cabecalho: number | null;
    h1: number | null;
    tamanhoH1: string | null;
    abertura: number | null;
    alturaTotal: number;
    vazaLargura: boolean;
    pequenos: string[];
  };

  const telas = medida.primeiroProduto === null ? null : (medida.primeiroProduto / alturaTela).toFixed(2);

  console.log(`\n${ALVO} · ${APARELHO.viewport.width}x${alturaTela} (iPhone 14 Pro)\n`);
  console.log(`  até o 1º produto:   ${medida.primeiroProduto ?? "(nenhum produto na home)"} px  = ${telas ?? "?"} telas`);
  console.log(`  cabeçalho:          ${medida.cabecalho} px`);
  console.log(`  título (h1):        ${medida.h1} px · fonte ${medida.tamanhoH1}`);
  console.log(`  abertura inteira:   ${medida.abertura} px`);
  console.log(`  página inteira:     ${medida.alturaTotal} px`);
  console.log(`  vaza na horizontal: ${medida.vazaLargura ? "SIM (defeito)" : "não"}`);
  if (medida.pequenos.length) {
    console.log(`  alvos < 44px (${medida.pequenos.length}):`);
    for (const p of medida.pequenos) console.log(`    · ${p}`);
  } else {
    console.log(`  alvos < 44px:       nenhum`);
  }

  const caminho = process.env.SCREENSHOT ?? "";
  if (caminho) {
    await pagina.screenshot({ path: caminho, fullPage: false });
    console.log(`\n  print: ${caminho}`);
  }

  await navegador.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
