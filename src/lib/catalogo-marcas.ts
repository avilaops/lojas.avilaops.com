import { prisma } from "./db";
import { marcaConfirmada } from "./marca-confirmada";

/** Marcas do catálogo inteiro do tenant, inclusive fora da página atual. */
export async function valoresDeMarcaDoCatalogo(tenantId: string): Promise<string[]> {
  const produtos = await prisma.produto.findMany({
    where: { tenantId, marca: { not: null } },
    distinct: ["marca"],
    select: { marca: true },
    orderBy: { marca: "asc" },
  });
  return produtos.map((p) => p.marca).filter((marca): marca is string => marcaConfirmada(marca) !== null);
}

export async function marcasDoCatalogo(tenantId: string): Promise<string[]> {
  const marcas = new Map<string, string>();
  for (const valor of await valoresDeMarcaDoCatalogo(tenantId)) {
    const marca = marcaConfirmada(valor)!;
    marcas.set(marca.toLocaleLowerCase("pt-BR"), marca);
  }
  return [...marcas.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
