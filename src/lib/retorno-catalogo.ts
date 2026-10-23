const PARAMETROS_DA_LISTAGEM = new Set([
  "q", "categoria", "marca", "modelo", "ano", "moto",
  "perfil", "material", "dureza", "vedacao", "fabricante", "min", "max", "ordem", "porPagina",
  "disponivel", "pagina",
  "di_de", "di_ate", "de_de", "de_ate", "alt_de", "alt_ate",
  "esp_de", "esp_ate", "sec_de", "sec_ate",
  "larg_de", "larg_ate", "comp_de", "comp_ate",
]);

function basePermitida(caminho: string) {
  return caminho === "/produtos" || /^\/categoria\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(caminho);
}

function queryPermitida(valores: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (!PARAMETROS_DA_LISTAGEM.has(chave) || !valor?.trim()) continue;
    query.set(chave, valor);
  }
  return query.toString();
}

/** URL exata da listagem que abriu a ficha, sem parâmetros fora do catálogo. */
export function retornoDaListagem(base: string, valores: Record<string, string | undefined>) {
  if (!basePermitida(base)) throw new Error("Base de retorno inválida.");
  const query = queryPermitida(valores);
  return `${base}${query ? `?${query}` : ""}`;
}

/**
 * Confere o retorno recebido pela ficha. Além de impedir redirecionamento para
 * outro host, reconstrói a query por allowlist para o link não carregar lixo.
 */
export function retornoSeguroDoCatalogo(valor: string | undefined) {
  if (!valor) return null;
  try {
    const url = new URL(valor, "https://loja.invalid");
    if (url.origin !== "https://loja.invalid" || !basePermitida(url.pathname)) return null;
    const query = queryPermitida(Object.fromEntries(url.searchParams));
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

export function hrefDoProduto(slug: string, retorno?: string | null) {
  const base = `/produtos/${encodeURIComponent(slug)}`;
  return retorno ? `${base}?voltar=${encodeURIComponent(retorno)}` : base;
}

export function hrefDaVariante(slug: string, varianteId: string, retorno?: string | null) {
  const query = new URLSearchParams({ variante: varianteId });
  if (retorno) query.set("voltar", retorno);
  return `/produtos/${encodeURIComponent(slug)}?${query.toString()}`;
}
