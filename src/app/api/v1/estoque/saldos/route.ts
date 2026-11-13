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
  };
  const [saldos, total] = await prisma.$transaction([
    prisma.saldoEstoque.findMany({ where, orderBy: { id: "asc" }, skip: p.pular, take: p.porPagina }),
    prisma.saldoEstoque.count({ where }),
  ]);
  return lista(saldos.map(s => ({ ...s, disponivel: s.fisico === null ? null : s.fisico - s.reservado })), p, total);
});
