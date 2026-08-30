import { cache } from "react";
import { prisma } from "./db";

/**
 * Consulta pública única por request. A página e generateMetadata compartilham
 * o mesmo resultado sem manter cache entre lojas ou entre publicações.
 */
export const buscarCategoriaPublica = cache((tenantId: string, slug: string) =>
  prisma.categoria.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
  }),
);
