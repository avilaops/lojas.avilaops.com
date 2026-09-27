/** Normalização comum a códigos e texto, sem apagar zeros ou trocar números. */
export function normalizarBusca(valor: string): string {
  return valor.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** A convenção de três medidas é DI × DE × altura, em mm, nessa ordem.
 * Polegadas, frações e pares de medidas não recebem conversão implícita. */
export function consultaDimensional(texto: string) {
  const normal = normalizarBusca(texto);
  if (/pol|inch|["″/]/.test(normal)) return null;
  const numero = "(\\d+(?:[.,]\\d+)?)";
  const padrao = new RegExp(`(?<![\\d.,])${numero}\\s*(?:mm\\s*)?[x×]\\s*${numero}\\s*(?:mm\\s*)?[x×]\\s*${numero}\\s*(?:mm\\b)?(?![\\d.,])`, "i");
  const m = normal.match(padrao);
  if (!m) return null;
  const valores = m.slice(1, 4).map(v => Number(v.replace(",", ".")));
  return { texto: normal.replace(m[0], " ").trim(), valores };
}

export function confereDimensoes(atributos: unknown, valores: number[]): boolean {
  const a = (atributos ?? {}) as Record<string, unknown>;
  return ["diametroInternoMm", "diametroExternoMm", "alturaMm"].every((chave, i) => {
    const n = Number(a[chave]);
    return n > 0 && n <= 3000 && Math.abs(n - valores[i]) < 0.000001;
  });
}

export function codigoExato(produto: { sku?: string | null; codigoOriginal?: string | null; codigosEquivalentes?: string[]; atributos?: unknown; variantes?: { sku: string | null; mpn: string | null; gtin: string | null }[] }, consulta: string): boolean {
  const a = (produto.atributos ?? {}) as Record<string, unknown>;
  const codigos = [produto.sku, produto.codigoOriginal, ...(produto.codigosEquivalentes ?? []), a.referencia, a.codigoFabricante, a.mpn,
    ...(produto.variantes ?? []).flatMap(v => [v.sku, v.mpn, v.gtin])];
  return codigos.some(c => typeof c === "string" && normalizarBusca(c) === normalizarBusca(consulta));
}
