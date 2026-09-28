import taxonomy from "./google-product-taxonomy.pt-BR.json";

const categoriasPorId = new Set(taxonomy.map(([id]) => id));
const idPorCaminho = new Map(
  taxonomy.map(([id, caminho]) => [normalizarCaminho(caminho), id]),
);

function normalizarCaminho(caminho: string): string {
  return caminho
    .trim()
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

/** Aceita só ID ou caminho existente na taxonomia oficial pt-BR. */
export function idDaCategoriaGoogle(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined;
  const entrada = valor.trim();
  if (/^\d+$/.test(entrada)) return categoriasPorId.has(entrada) ? entrada : undefined;
  return idPorCaminho.get(normalizarCaminho(entrada));
}

export function categoriaGoogleValida(valor: string | null | undefined): boolean {
  return valor == null || valor.trim() === "" || idDaCategoriaGoogle(valor) !== undefined;
}
