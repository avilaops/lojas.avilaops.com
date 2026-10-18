import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import localFont from "next/font/local";
import { Inter, Montserrat, Playfair_Display, Poppins } from "next/font/google";
import type { TemaLoja } from "./tema";
import { extrairPreCargas } from "./fontes-pre-carga";

/**
 * As fontes que o tema oferece, servidas pelo próprio site.
 *
 * Antes cada loja puxava a folha do Google Fonts: como `<link>` no head ela
 * segurava a primeira pintura (1,5 s no PageSpeed de celular); carregada
 * depois, a fonte chegava tarde, o texto era redesenhado e o maior elemento da
 * tela (LCP) passava de 4 s, com deslocamento de layout. `next/font` baixa os
 * arquivos no build, serve do mesmo domínio e gera uma fonte reserva com as
 * métricas ajustadas, então a troca quase não mexe no texto.
 *
 * Sem `preload`: o layout é um só para todas as lojas e pré-carregaria as
 * quatro famílias em cada página. O navegador busca só a que o CSS usa.
 */
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
/**
 * Serifa do Ateliê. Arquivo nosso, licença OFL em `src/fonts/OFL-dm-serif-display.txt`.
 * Não passa pelo Google nem no build nem no navegador. Archivo continua sendo
 * a fonte da marca Ávila onde ela já está; aqui só entra a serifa da vitrine.
 */
const dmSerif = localFont({
  src: "../fonts/dm-serif-display-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

const FAMILIAS: Partial<Record<TemaLoja["fonte"], string>> = {
  inter: inter.style.fontFamily,
  poppins: poppins.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  playfair: playfair.style.fontFamily,
  "dm-serif": dmSerif.style.fontFamily,
};

const SERIFAS = new Set<TemaLoja["fonte"]>(["playfair", "dm-serif"]);

/** `font-family` da fonte do tema já com a reserva ajustada; `undefined` na fonte do sistema. */
export function familiaHospedada(fonte: TemaLoja["fonte"]): string | undefined {
  const familia = FAMILIAS[fonte];
  return familia ? `${familia}, ${SERIFAS.has(fonte) ? "Georgia, serif" : "system-ui, sans-serif"}` : undefined;
}

/** Família da serifa do Ateliê, para o título mesmo quando o corpo é outra fonte. */
export function familiaSerifAtelie(): string {
  return familiaHospedada("dm-serif") ?? '"DM Serif Display", Georgia, serif';
}

/**
 * Arquivos da fonte da loja que valem pré-carregar: o recorte latino nos pesos
 * do texto (400) e dos títulos (700).
 *
 * Sem pré-carga a fonte só começa a baixar depois do CSS; quando chega, o texto
 * é redesenhado, e o PageSpeed conta essa troca como o LCP da página e como
 * deslocamento de layout. O `preload` do `next/font` é por rota, não por loja,
 * então o endereço sai daqui: lido uma vez do CSS que o build gerou
 * (`.next/static/chunks/*.css`), pela família e pelo recorte. Se o arquivo não
 * for achado (formato do build mudou), a loja só fica sem a pré-carga.
 */
const PRE_CARGAS = new Map<string, string[]>();

/** Endereços a pré-carregar para a fonte do tema; vazio na fonte do sistema ou se o CSS não for achado. */
export function preCargasDaFonte(fonte: TemaLoja["fonte"]): string[] {
  const familia = FAMILIAS[fonte]?.match(/^["']?([^,"']+)/)?.[1]?.trim();
  if (!familia) return [];
  const conhecido = PRE_CARGAS.get(familia);
  if (conhecido) return conhecido;
  let urls: string[] = [];
  try {
    const pasta = path.join(process.cwd(), ".next", "static", "chunks");
    const css = readdirSync(pasta).filter((a) => a.endsWith(".css")).map((a) => readFileSync(path.join(pasta, a), "utf8")).join("\n");
    urls = extrairPreCargas(css, familia);
  } catch {
    urls = [];
  }
  PRE_CARGAS.set(familia, urls);
  return urls;
}
