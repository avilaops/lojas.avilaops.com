import { MEDIDAS_FILTRAVEIS, type ChaveDeMedida, type FiltroCatalogo, type OrdemCatalogo } from "./catalogo";

/**
 * A URL de uma listagem vira filtro de catálogo.
 *
 * Mora aqui, e não dentro de uma página, porque são duas as listagens que
 * filtram — `/produtos` e `/categoria/<slug>` — e um parser por página é a
 * receita para `?min=10` funcionar numa e ser ignorado na outra. É tudo puro:
 * serve ao servidor e ao teste, sem Prisma e sem React.
 */

/** Prefixo curto de cada medida na URL: `di_de=20&di_ate=25`. */
export const PREFIXO_DE_MEDIDA: Record<ChaveDeMedida, string> = {
  diametroInternoMm: "di",
  diametroExternoMm: "de",
  alturaMm: "alt",
  espessuraMm: "esp",
  secaoMm: "sec",
};

const ORDENS = new Set<OrdemCatalogo>(["relevancia", "menor-preco", "maior-preco", "recentes", "nome"]);

/** Ordem desconhecida na URL não quebra a página: vale a relevância. */
export function ordemDaUrl(sp: Record<string, string | undefined>): OrdemCatalogo {
  return ORDENS.has(sp.ordem as OrdemCatalogo) ? (sp.ordem as OrdemCatalogo) : "relevancia";
}

/**
 * "R$ 1.234,50" → 123450. Dinheiro é centavos inteiros, nunca float.
 *
 * O ponto de milhar era lido como decimal: quem digitava `1.234,50` no campo
 * de preço mínimo filtrava por **R$ 1,23** e recebia o catálogo quase inteiro
 * de volta, sem nada na tela explicando por quê. Com vírgula presente, todo
 * ponto é milhar; sem vírgula, só é milhar quando separa grupos de três
 * dígitos (`1.234`), senão `20.5` deixaria de ser vinte e cinquenta.
 */
export function centavosDaUrl(v?: string): number | undefined {
  if (!v) return undefined;
  let limpo = v.replace(/[^\d,.]/g, "");
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

/** "20", "20,5" ou "20.5" → 20.5. Milímetro aceita vírgula: é como se escreve aqui. */
export function milimetroDaUrl(v?: string): number | undefined {
  if (!v) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(v.trim())) return undefined;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Faixas de medida vindas da URL (`di_de`, `di_ate`, `de_de`…). Só entra a
 * medida que tem pelo menos um extremo: faixa vazia não filtra nada e não
 * pode virar `{}`, que excluiria todo produto sem aquele atributo.
 */
export function faixasDaUrl(sp: Record<string, string | undefined>) {
  const fora: Partial<Record<ChaveDeMedida, { de?: number; ate?: number }>> = {};
  for (const campo of Object.keys(MEDIDAS_FILTRAVEIS) as ChaveDeMedida[]) {
    const prefixo = PREFIXO_DE_MEDIDA[campo];
    const de = milimetroDaUrl(sp[`${prefixo}_de`]);
    const ate = milimetroDaUrl(sp[`${prefixo}_ate`]);
    if (de != null || ate != null) fora[campo] = { de, ate };
  }
  return Object.keys(fora).length ? fora : undefined;
}

/**
 * O filtro que a URL descreve. Quem chama acrescenta o que é da página —
 * categoria fixa, moto, limite e página.
 */
export function filtroDaUrl(sp: Record<string, string | undefined>): FiltroCatalogo {
  return {
    busca: sp.q?.trim() || undefined,
    perfil: sp.perfil?.trim() || undefined,
    fabricante: sp.fabricante?.trim() || undefined,
    ordem: ordemDaUrl(sp),
    minCentavos: centavosDaUrl(sp.min),
    maxCentavos: centavosDaUrl(sp.max),
    medidas: faixasDaUrl(sp),
  };
}
