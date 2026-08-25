import type { Categoria, Produto, Tenant } from "@prisma/client";
import type { IdentidadeLoja } from "@/lib/identidade";

/** Os mesmos dados alimentam os quatro layouts; só a composição muda. */
export interface DadosHome {
  t: Tenant;
  identidade: IdentidadeLoja;
  categorias: Categoria[];
  vitrine: Produto[];
  temDestaques: boolean;
  vende: boolean;
}
