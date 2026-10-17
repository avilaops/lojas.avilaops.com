import { z } from "zod";

/** R$ 100 milhões: acima disso é centavos confundidos com reais. */
const TETO_CENTAVOS = 10_000_000_000;

/** O que o painel da Ávila Ops pode alterar num produto, e com que identificação. */
export const EdicaoPeloAdmin = z
  .object({
    /**
     * Quem está editando, como o painel da Ávila Ops o conhece. Vai para a
     * origem do histórico (`avilaops:<autor>`): sem isto o registro diria só
     * de onde veio, e não de quem.
     */
    autor: z.string().trim().min(1).max(60),
    /** A versão do catálogo que a pessoa estava olhando. Se o produto mudou depois, nada é gravado. */
    versao: z.number().int().positive(),
    ativo: z.boolean().optional(),
    /** Slug de uma categoria da loja; `null` tira o produto da categoria. */
    categoria: z.string().trim().min(1).max(120).nullable().optional(),
    precoCentavos: z.number().int().min(0).max(TETO_CENTAVOS).optional(),
    precoDeCentavos: z.number().int().positive().max(TETO_CENTAVOS).nullable().optional(),
  })
  .strict()
  .refine(
    (e) => e.ativo !== undefined || e.categoria !== undefined || e.precoCentavos !== undefined || e.precoDeCentavos !== undefined,
    "informe ao menos um campo para alterar",
  );
