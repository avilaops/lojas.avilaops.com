import { z } from "zod";

export const ConsultaEtiquetas = z.object({
  q: z.string().trim().max(100).default(""),
  produtoId: z.string().min(1).max(64).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  tipo: z.enum(["interno", "gtin"]).default("interno"),
});

export type TipoCodigoEtiqueta = "interno" | "gtin";
export type ItemEtiqueta = {
  id: string;
  produtoId: string;
  nome: string;
  variacao: string | null;
  sku: string | null;
  precoCentavos: number | null;
  codigo: string | null;
  svg: string | null;
  erro: string | null;
};

/** O ID persistido distingue variações, independe de nome/preço e não ocupa o GTIN. */
export function codigoInterno(varianteId: string): string {
  // A migração do catálogo criou IDs vp_<md5>. Decimal mantém todos os bits
  // e permite ao Code 128 compactar pares de dígitos, sem truncar o identificador.
  if (varianteId.length === 35 && /^vp_[a-f0-9]{32}$/.test(varianteId)) {
    return `V:M${BigInt(`0x${varianteId.slice(3)}`).toString(10)}`;
  }
  if (varianteId.length !== 25 || !/^[a-z0-9]{25}$/.test(varianteId)) throw new Error("Identificador incompatível com a etiqueta interna.");
  return `V:${varianteId}`;
}

export function lerCodigoInterno(codigo: string): string | null {
  if (codigo.length <= 42 && /^V:M(?:0|[1-9][0-9]{0,38})$/.test(codigo) && codigo === codigo.trim()) {
    const hex = BigInt(codigo.slice(3)).toString(16);
    return hex.length <= 32 ? `vp_${hex.padStart(32, "0")}` : null;
  }
  return codigo.length === 27 && /^V:[a-z0-9]{25}$/.test(codigo) ? codigo.slice(2) : null;
}

export const MAX_ETIQUETAS = 200;

export function quantidadeValida(quantidade: number): boolean {
  return Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= MAX_ETIQUETAS;
}
