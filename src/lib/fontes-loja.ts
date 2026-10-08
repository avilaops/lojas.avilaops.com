import { Inter, Montserrat, Playfair_Display, Poppins } from "next/font/google";
import type { TemaLoja } from "./tema";

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

const FAMILIAS: Partial<Record<TemaLoja["fonte"], string>> = {
  inter: inter.style.fontFamily,
  poppins: poppins.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  playfair: playfair.style.fontFamily,
};

/** `font-family` da fonte do tema já com a reserva ajustada; `undefined` na fonte do sistema. */
export function familiaHospedada(fonte: TemaLoja["fonte"]): string | undefined {
  const familia = FAMILIAS[fonte];
  return familia ? `${familia}, ${fonte === "playfair" ? "Georgia, serif" : "system-ui, sans-serif"}` : undefined;
}
