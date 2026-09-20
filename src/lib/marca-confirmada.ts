/** Devolve marca de fabricante utilizável ou null para marcadores legados. */
export function marcaConfirmada(valor: string | null | undefined): string | null {
  const marca = valor?.trim();
  if (!marca || marca.toLocaleUpperCase("pt-BR") === "DIVERSOS") return null;
  return marca;
}
