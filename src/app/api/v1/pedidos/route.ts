import type { PedidoStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { pedidoDaApi } from "@/lib/api-recursos";
import { lerData, lerOpcao, lerPaginacao, lista } from "@/lib/api-resposta";

/**
 * GET /api/v1/pedidos — pedidos da loja, do mais novo para o mais antigo.
 *
 * Filtros: `status`, `canal` (loja | mercadolivre), `criadoDesde` e
 * `atualizadoDesde` (para buscar só o que mudou de status desde a última vez).
 */
export const dynamic = "force-dynamic";

const STATUS: readonly PedidoStatus[] = ["AGUARDANDO_PAGAMENTO", "PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO", "ESTORNADO"];

export const GET = rotaDaApi({ escopo: "pedidos:ler" }, async ({ tenant, url }) => {
  const q = url.searchParams;
  const pagina = lerPaginacao(q);
  const status = lerOpcao(q, "status", STATUS);
  const canal = lerOpcao(q, "canal", ["loja", "mercadolivre"] as const);
  const criadoDesde = lerData(q, "criadoDesde");
  const atualizadoDesde = lerData(q, "atualizadoDesde");

  const where: Prisma.PedidoWhereInput = {
    tenantId: tenant.id,
    ...(status ? { status } : {}),
    ...(canal ? { canal } : {}),
    ...(criadoDesde ? { criadoEm: { gte: criadoDesde } } : {}),
    ...(atualizadoDesde ? { atualizadoEm: { gte: atualizadoDesde } } : {}),
  };

  const [total, pedidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      include: { itens: true, postagem: { select: { codigoObjeto: true } } },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: pagina.pular,
      take: pagina.porPagina,
    }),
  ]);

  return lista(pedidos.map(pedidoDaApi), pagina, total);
});
