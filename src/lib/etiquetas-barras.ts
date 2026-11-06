import bwipjs from "bwip-js/node";
import { gtinValido } from "./catalogo-oferta";
import { lerCodigoInterno, type TipoCodigoEtiqueta } from "./etiquetas";

export function gerarBarras(codigo: string, tipo: TipoCodigoEtiqueta): string {
  if (tipo === "interno" && !lerCodigoInterno(codigo)) throw new Error("Código interno inválido.");
  if (tipo === "gtin" && (codigo !== codigo.trim() || !gtinValido(codigo))) throw new Error("Confira o GTIN no cadastro: formato ou dígito verificador inválido.");
  const formatos: Record<number, string> = { 8: "ean8", 12: "upca", 13: "ean13", 14: "itf14" };
  return bwipjs.toSVG({
    bcid: tipo === "interno" ? "code128" : formatos[codigo.length],
    text: codigo,
    scale: 1,
    height: 20,
    // Quiet zones ficam dentro do SVG e não dependem da margem da impressora.
    paddingwidth: 12,
    paddingheight: 2,
    backgroundcolor: "FFFFFF",
    includetext: false,
  });
}
