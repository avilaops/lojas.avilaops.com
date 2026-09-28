/** Referências geradas na importação não ajudam o comprador a identificar a peça. */
export function codigoPublico(sku: string | null | undefined): string | null {
  const codigo = sku?.trim();
  return codigo && !/^JARBAS-[a-f0-9]+$/i.test(codigo) ? codigo : null;
}

/**
 * Como o código aparece para o comprador. Muita loja usa o código de barras
 * como SKU; aí "Código 7898…" não diz o que é, e quem compara com a embalagem
 * ou com outro site procura por "EAN". Quando SKU e GTIN são o mesmo número,
 * o rótulo diz isso.
 */
export function rotuloDoCodigo(sku: string | null | undefined, gtin: string | null | undefined): "EAN" | "Código" {
  const codigo = sku?.trim();
  return codigo && codigo === gtin?.trim() && /^\d{8,14}$/.test(codigo) ? "EAN" : "Código";
}
