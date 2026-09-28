/** Referências geradas na importação não ajudam o comprador a identificar a peça. */
export function codigoPublico(sku: string | null | undefined): string | null {
  const codigo = sku?.trim();
  return codigo && !/^JARBAS-[a-f0-9]+$/i.test(codigo) ? codigo : null;
}
