import { prisma } from "./db";
import { marcaConfirmada } from "./marca-confirmada";

/** Marcas do catálogo inteiro do tenant, inclusive fora da página atual. */
export async function marcasDoCatalogo(tenantId: string): Promise<string[]> {
  const produtos = await prisma.produto.findMany({
    where: { tenantId, marca: { not: null } },
    distinct: ["marca"],
    select: { marca: true },
    orderBy: { marca: "asc" },
  });
  return produtos.map((p) => p.marca).filter((marca): marca is string => marcaConfirmada(marca) !== null);
}
