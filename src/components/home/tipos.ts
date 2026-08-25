import type { Categoria, Produto, Tenant } from "@prisma/client";

/** Os mesmos dados alimentam os quatro layouts; só a composição muda. */
export interface DadosHome {
  t: Tenant;
  categorias: Categoria[];
  vitrine: Produto[];
  temDestaques: boolean;
  vende: boolean;
}
