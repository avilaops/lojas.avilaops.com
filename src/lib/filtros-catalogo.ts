import type { ChaveDeMedida, FiltroCatalogo, OrdemCatalogo } from "./catalogo";

const ORDENS = new Set<OrdemCatalogo>(["relevancia", "menor-preco", "maior-preco", "recentes", "nome"]);
const reais = (v?: string) => {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
};

/** "20", "20,5" ou "20.5" → 20.5. Milímetro aceita vírgula: é como se escreve aqui. */
const mm = (v?: string) => {
  if (!v) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(v.trim())) return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * Faixas de medida vindas da URL (`di_de`, `di_ate`, `de_de`…). Só entra a
 * medida que tem pelo menos um extremo: faixa vazia não filtra nada e não
 * pode virar `{}`, que excluiria todo produto sem aquele atributo.
 */
export function faixasDaUrl(sp: Record<string, string | undefined>) {
  const campos: Array<[ChaveDeMedida, string]> = [
    ["diametroInternoMm", "di"],
    ["diametroExternoMm", "de"],
    ["alturaMm", "alt"],
    ["espessuraMm", "esp"],
    ["secaoMm", "sec"],
  ];
  const fora: Partial<Record<ChaveDeMedida, { de?: number; ate?: number }>> = {};
  for (const [campo, prefixo] of campos) {
    const d = mm(sp[`${prefixo}_de`]);
    const a = mm(sp[`${prefixo}_ate`]);
    if (d != null || a != null) fora[campo] = { de: d, ate: a };
  }
  return Object.keys(fora).length ? fora : undefined;
}

/** A categoria da rota prevalece sobre parâmetros fornecidos no endereço. */
export function filtrosDaUrl(sp: Record<string, string | undefined>, categoriaFixa?: string): FiltroCatalogo {
  return { busca: sp.q?.trim() || undefined, perfil: sp.perfil || undefined,
    fabricante: sp.fabricante?.trim() || undefined, categoriaSlug: categoriaFixa ?? sp.categoria ?? undefined,
    ordem: ORDENS.has(sp.ordem as OrdemCatalogo) ? sp.ordem as OrdemCatalogo : "relevancia",
    minCentavos: reais(sp.min), maxCentavos: reais(sp.max), medidas: faixasDaUrl(sp) };
}
export const TAMANHOS_PAGINA = [24, 48, 96] as const;
export function porPaginaDaUrl(sp: Record<string, string | undefined>): number {
  const n = Number(sp.porPagina);
  return TAMANHOS_PAGINA.some(t => t === n) ? n : 48;
}
