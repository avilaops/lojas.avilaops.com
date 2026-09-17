import type { Categoria, Produto, Tenant } from "@prisma/client";
import type { IdentidadeLoja } from "@/lib/identidade";
import type { Moto } from "@/lib/motos";
import type { NECESSIDADES } from "@/lib/farmacia";

/** Os mesmos dados alimentam todos os layouts; só a composição muda. */
export interface DadosHome {
  t: Tenant;
  identidade: IdentidadeLoja;
  categorias: Categoria[];
  vitrine: Produto[];
  temDestaques: boolean;
  vende: boolean;
  moto?: Moto | null;
  /**
   * Atalhos por necessidade que a loja de farmácia tem como atender. Já vêm
   * filtrados pelo catálogo — ver `necessidadesDaLoja`.
   */
  necessidades?: typeof NECESSIDADES;
}
