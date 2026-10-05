import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { produtoDaApi } from "@/lib/api-recursos";
import { lerBooleano, lerData, lerPaginacao, lista } from "@/lib/api-resposta";
import { termosDeBusca } from "@/lib/catalogo";
import { urlDaLoja } from "@/lib/tenant";

/**
 * GET /api/v1/produtos — o catálogo como o painel vê, inclusive inativos.
 *
 * Filtros: `ativo`, `categoria` (slug), `sku` (exato), `busca` (mesmos termos
 * da busca da loja) e `atualizadoDesde` — este é o que um ERP usa para
 * sincronizar só o que mudou desde a última passada.
 */
export const dynamic = "force-dynamic";

export const GET = rotaDaApi({ escopo: "catalogo:ler" }, async ({ tenant, url }) => {
  const q = url.searchParams;
  const pagina = lerPaginacao(q);
  const ativo = lerBooleano(q, "ativo");
  const atualizadoDesde = lerData(q, "atualizadoDesde");
  const termos = termosDeBusca(q.get("busca") ?? "");
  const categoria = q.get("categoria");
  const sku = q.get("sku");

  const where: Prisma.ProdutoWhereInput = {
    tenantId: tenant.id,
    ...(ativo != null ? { ativo } : {}),
    ...(categoria ? { categoria: { slug: categoria } } : {}),
    ...(sku ? { sku } : {}),
    ...(atualizadoDesde ? { atualizadoEm: { gte: atualizadoDesde } } : {}),
    ...(termos.length ? { AND: termos.map((t) => ({ busca: { contains: t } })) } : {}),
  };

  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      include: { categoria: { select: { id: true, slug: true, nome: true } } },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: pagina.pular,
      take: pagina.porPagina,
    }),
  ]);

  const base = urlDaLoja(tenant);
  return lista(produtos.map((p) => produtoDaApi(p, base)), pagina, total);
});
