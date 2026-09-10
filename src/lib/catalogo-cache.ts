import { revalidateTag } from "next/cache";
import { etiquetaDoCatalogo } from "./catalogo";

/**
 * Derruba o que está guardado por loja (faixas de medida, motos) quando o
 * catálogo muda. Quem escreve produto chama isto; ver docs/VITRINE-CACHE.md.
 *
 * Arquivo separado porque `revalidateTag` só existe no servidor, e
 * `catalogo.ts` é importado por componentes de cliente (`formatarBRL`).
 */
export function invalidarCatalogo(tenantId: string): void {
  revalidateTag(etiquetaDoCatalogo(tenantId), "max");
}
