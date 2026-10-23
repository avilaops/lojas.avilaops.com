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

/**
 * "R$ 1.234,50" → 123450. Dinheiro é centavos inteiros, nunca float.
 *
 * O ponto de milhar era lido como decimal: quem digitava `1.234,50` no campo
 * de preço mínimo filtrava por R$ 1,23 e recebia o catálogo quase inteiro de
 * volta. Com vírgula presente, todo ponto é milhar; sem vírgula, só é milhar
 * quando separa grupos de três dígitos (`1.234`), senão `20.5` deixaria de
 * ser vinte e cinquenta.
 */
export function reaisDaUrl(v?: string): number | undefined {
  if (!v) return undefined;
  let limpo = v.replace(/[^\d,.]/g, "");
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  const n = Number.parseFloat(limpo);
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
    ["larguraMm", "larg"],
    ["comprimentoMm", "comp"],
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
    atributos: {
      ...(sp.material?.trim() ? { material: sp.material.trim() } : {}),
      ...(sp.dureza?.trim() ? { dureza: sp.dureza.trim() } : {}),
      ...(sp.vedacao?.trim() ? { vedacao: sp.vedacao.trim() } : {}),
    },
    fabricante: sp.fabricante?.trim() || undefined,
    categoriaSlug: categoriaSlug ?? (sp.categoria || undefined),
    ordem: ordemDaUrl(sp),
    minCentavos: reaisDaUrl(sp.min),
    maxCentavos: reaisDaUrl(sp.max),
    medidas: faixasDaUrl(sp),
    somenteDisponiveis: sp.disponivel === "1",
  };
}

/**
 * Quantos produtos por página o comprador escolheu. Só três tamanhos: valor
 * livre na URL viraria consulta de 100 mil linhas ou divisão por zero.
 */
export const TAMANHOS_PAGINA = [24, 48, 96] as const;

export function porPaginaDaUrl(sp: ParametrosDaVitrine): number {
  const n = Number(sp.porPagina);
  return TAMANHOS_PAGINA.some((t) => t === n) ? n : 48;
}

const FILTROS_SECUNDARIOS = [
  "perfil", "material", "dureza", "vedacao", "fabricante", "min", "max", "disponivel",
  "di_de", "di_ate", "de_de", "de_ate", "alt_de", "alt_ate",
  "esp_de", "esp_ate", "sec_de", "sec_ate",
  "larg_de", "larg_ate", "comp_de", "comp_ate",
] as const;

/** Filtro que mora na gaveta mobile; busca livre não deve abri-la sozinha. */
export function temFiltroSecundarioAtivo(sp: ParametrosDaVitrine): boolean {
  return FILTROS_SECUNDARIOS.some((chave) => Boolean(sp[chave]?.trim()))
    || Boolean(sp.ordem && sp.ordem !== "relevancia");
}

/** Algum filtro além da página? Usado para explicar uma listagem vazia. */
export function temFiltroAtivo(sp: ParametrosDaVitrine): boolean {
  return Boolean(sp.q?.trim()) || temFiltroSecundarioAtivo(sp);
}

/** Estado que realmente restringe ou reordena o catálogo; ignora busca e campanha. */
export function temFiltroCatalogoAplicado(sp: ParametrosDaVitrine): boolean {
  return temFiltroSecundarioAtivo(sp)
    || Boolean(sp.categoria || sp.marca || sp.modelo || sp.ano || (sp.moto && sp.moto !== "todas"));
}

const CAMPOS_DA_CONSULTA_TECNICA = [
  "di_de", "di_ate", "de_de", "de_ate", "alt_de", "alt_ate",
  "esp_de", "esp_ate", "sec_de", "sec_ate", "larg_de", "larg_ate", "comp_de", "comp_ate",
  "perfil", "material", "dureza", "vedacao",
] as const;

export function temConsultaTecnica(sp: ParametrosDaVitrine): boolean {
  return Boolean(sp.q?.trim()) || CAMPOS_DA_CONSULTA_TECNICA.some((campo) => Boolean(sp[campo]?.trim()));
}
