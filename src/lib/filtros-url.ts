import type { ChaveDeMedida, FiltroCatalogo, OrdemCatalogo } from "./catalogo";

/**
 * Os filtros da vitrine lidos da URL — um lugar só para `/produtos` e
 * `/categoria/<slug>`.
 *
 * A página de categoria não tinha filtro nenhum: mandava para
 * `/produtos?categoria=...`, e quem estava em "O-Rings" perdia a página, o
 * título e a trilha para filtrar por medida. Com a leitura aqui, as duas
 * rotas entendem a mesma URL e contam o mesmo conjunto.
 */
export type ParametrosDaVitrine = Record<string, string | undefined>;

const ORDENS = new Set<OrdemCatalogo>(["relevancia", "menor-preco", "maior-preco", "recentes", "nome"]);

export function ordemDaUrl(sp: ParametrosDaVitrine): OrdemCatalogo {
  return ORDENS.has(sp.ordem as OrdemCatalogo) ? (sp.ordem as OrdemCatalogo) : "relevancia";
}

/** "12,50", "12.5" ou "R$ 12" → centavos. */
export function reaisDaUrl(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

/** "20", "20,5" ou "20.5" → 20.5. Milímetro aceita vírgula: é como se escreve aqui. */
export function mmDaUrl(v?: string): number | undefined {
  if (!v) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(v.trim())) return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Faixas de medida vindas da URL (`di_de`, `di_ate`, `de_de`…). Só entra a
 * medida que tem pelo menos um extremo: faixa vazia não filtra nada e não
 * pode virar `{}`, que excluiria todo produto sem aquele atributo.
 */
export function faixasDaUrl(sp: ParametrosDaVitrine): FiltroCatalogo["medidas"] {
  const campos: Array<[ChaveDeMedida, string]> = [
    ["diametroInternoMm", "di"],
    ["diametroExternoMm", "de"],
    ["alturaMm", "alt"],
    ["espessuraMm", "esp"],
    ["secaoMm", "sec"],
  ];
  const fora: Partial<Record<ChaveDeMedida, { de?: number; ate?: number }>> = {};
  for (const [campo, prefixo] of campos) {
    const d = mmDaUrl(sp[`${prefixo}_de`]);
    const a = mmDaUrl(sp[`${prefixo}_ate`]);
    if (d != null || a != null) fora[campo] = { de: d, ate: a };
  }
  return Object.keys(fora).length ? fora : undefined;
}

/** O filtro completo da URL. A categoria vem da rota quando a página é de categoria. */
export function filtroDaUrl(sp: ParametrosDaVitrine, categoriaSlug?: string): FiltroCatalogo {
  return {
    busca: sp.q?.trim() || undefined,
    perfil: sp.perfil || undefined,
    fabricante: sp.fabricante?.trim() || undefined,
    categoriaSlug: categoriaSlug ?? (sp.categoria || undefined),
    ordem: ordemDaUrl(sp),
    minCentavos: reaisDaUrl(sp.min),
    maxCentavos: reaisDaUrl(sp.max),
    medidas: faixasDaUrl(sp),
    somenteDisponiveis: sp.disponivel === "1",
  };
}

/** Algum filtro além da página? Decide se a gaveta de filtros abre sozinha. */
export function temFiltroAtivo(sp: ParametrosDaVitrine): boolean {
  return ["q", "perfil", "fabricante", "min", "max", "disponivel", "di_de", "di_ate", "de_de", "de_ate", "alt_de", "alt_ate", "esp_de", "esp_ate", "sec_de", "sec_ate"].some((k) => Boolean(sp[k]))
    || Boolean(sp.ordem && sp.ordem !== "relevancia");
}
