const LIMITE_CATEGORIAS = 6;
const LIMITE_MARCAS = 12;
const TOLERANCIA_MM = 0.5;

type ValoresDimensionais = Record<"di" | "de" | "alt", string>;

export function numeroEmMilimetros(texto: string): number | null {
  const valor = Number(texto.trim().replace(",", "."));
  return texto.trim() !== "" && Number.isFinite(valor) && valor > 0 && valor < 10000 ? valor : null;
}

export function urlDaBuscaPorMedida(valores: ValoresDimensionais): string | null {
  const parametros = new URLSearchParams();

  for (const prefixo of ["di", "de", "alt"] as const) {
    const milimetros = numeroEmMilimetros(valores[prefixo]);
    if (milimetros == null) continue;
    parametros.set(`${prefixo}_de`, String(Math.max(0, +(milimetros - TOLERANCIA_MM).toFixed(2))));
    parametros.set(`${prefixo}_ate`, String(+(milimetros + TOLERANCIA_MM).toFixed(2)));
  }

  return parametros.size > 0 ? `/produtos?${parametros.toString()}` : null;
}

export function dadosDaHomeIndustrial<T>(categorias: T[], marcas: string[]) {
  const vistas = new Set<string>();
  const marcasConfirmadas: string[] = [];

  for (const valor of marcas) {
    const marca = valor.trim();
    const chave = marca.toLocaleLowerCase("pt-BR");
    if (!marca || vistas.has(chave)) continue;
    vistas.add(chave);
    marcasConfirmadas.push(marca);
    if (marcasConfirmadas.length === LIMITE_MARCAS) break;
  }

  return {
    categorias: categorias.slice(0, LIMITE_CATEGORIAS),
    marcas: marcasConfirmadas,
  };
}
