import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { lerPaginacao, lista } from "@/lib/api-resposta";

export const dynamic = "force-dynamic";

export const GET = rotaDaApi({ escopo: "catalogo:ler" }, async ({ tenant, url }) => {
  const p = lerPaginacao(url.searchParams);
  const where = {
    tenantId: tenant.id,
    ...(url.searchParams.has("varianteId") ? { varianteId: url.searchParams.get("varianteId")! } : {}),
    ...(url.searchParams.has("local") ? { local: url.searchParams.get("local")! } : {}),
    ...(url.searchParams.has("comandoId") ? { comandoId: url.searchParams.get("comandoId")! } : {}),
  };
  const [linhas, total] = await prisma.$transaction([
    prisma.razaoEstoque.findMany({ where, orderBy: { sequencia: "asc" }, skip: p.pular, take: p.porPagina }),
    prisma.razaoEstoque.count({ where }),
  ]);
  return lista(linhas.map(l => ({ ...l, sequencia: String(l.sequencia) })), p, total);
});
