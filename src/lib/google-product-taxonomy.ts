import taxonomy from "./google-product-taxonomy.pt-BR.json";

const categoriasPorId = new Set(taxonomy.map(([id]) => id));
const caminhoPorId = new Map(taxonomy.map(([id, caminho]) => [id, caminho]));
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

/**
 * Ramos em que o Google aceita ilustração como imagem principal.
 *
 * A regra de imagem do Merchant recusa desenho, gráfico e imagem genérica, com
 * duas exceções escritas na especificação de `image_link`: Ferragens (632) e
 * Veículos e peças (888). É onde peça técnica se vende por desenho de catálogo
 * (perfil de gaxeta, rolamento, retentor), e não por fotografia de cada medida.
 */
const RAIZES_COM_ILUSTRACAO = ["632", "888"].map((id) => caminhoPorId.get(id)).filter((c): c is string => Boolean(c));

/** Diz se a prateleira (ID ou caminho) fica num ramo em que ilustração é aceita. */
export function categoriaAceitaIlustracao(valor: string | number | null | undefined): boolean {
  const id = idDaCategoriaGoogle(valor == null ? null : String(valor));
  const caminho = id ? caminhoPorId.get(id) : undefined;
  return Boolean(caminho) && RAIZES_COM_ILUSTRACAO.some((raiz) => caminho === raiz || caminho!.startsWith(`${raiz} > `));
}
