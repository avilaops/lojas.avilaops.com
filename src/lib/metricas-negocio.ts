import { prisma } from "./db";
import { STATUS_VENDA_ANALYTICS } from "./analytics-vendas";
import type { LojaDoRelatorio, Negocio24h } from "./metricas-relatorio";

/**
 * A metade das métricas que vem do banco: sessões da vitrine e pedidos das
 * últimas 24 h, de todas as lojas de uma vez. Só lê.
 *
 * São agregações por `tenantId`, e não uma consulta por loja: o relatório é a
 * visão do operador com todas lado a lado, e N lojas não podem virar N idas ao
 * banco a cada leitura do n8n.
 */

const DIA_MS = 86_400_000;

export async function lerNegocio24h(agora: Date, tenantIds?: string[]): Promise<{ lojas: LojaDoRelatorio[]; negocio: Map<string, Negocio24h> }> {
  const desde = new Date(agora.getTime() - DIA_MS);
  const daLoja = tenantIds ? { in: tenantIds } : undefined;
  const pagos = STATUS_VENDA_ANALYTICS as readonly string[];

  const [lojas, sessoes, pedidos, comSessao] = await Promise.all([
    prisma.tenant.findMany({ where: { id: daLoja }, select: { id: true, slug: true, nome: true, status: true, dominios: true } }),
    prisma.sessaoVitrine.groupBy({ by: ["tenantId"], where: { tenantId: daLoja, criadoEm: { gte: desde } }, _count: { _all: true } }),
    prisma.pedido.groupBy({ by: ["tenantId", "status"], where: { tenantId: daLoja, criadoEm: { gte: desde } }, _count: { _all: true } }),
    // Pedido de marketplace e compra com cookie recusado não passaram por uma
    // sessão medida: contá-los na conversão inflaria a taxa da vitrine.
    prisma.pedido.groupBy({
      by: ["tenantId"],
      where: { tenantId: daLoja, criadoEm: { gte: desde }, status: { in: [...STATUS_VENDA_ANALYTICS] }, sessaoId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const negocio = new Map<string, Negocio24h>();
  const de = (tenantId: string) => {
    let n = negocio.get(tenantId);
    if (!n) {
      n = { sessoes: 0, pedidosCriados: 0, pedidosPagos: 0, pedidosPagosComSessao: 0 };
      negocio.set(tenantId, n);
    }
    return n;
  };
  for (const s of sessoes) de(s.tenantId).sessoes = s._count._all;
  for (const p of pedidos) {
    const n = de(p.tenantId);
    n.pedidosCriados += p._count._all;
    if (pagos.includes(p.status)) n.pedidosPagos += p._count._all;
  }
  for (const p of comSessao) de(p.tenantId).pedidosPagosComSessao = p._count._all;

  return { lojas, negocio };
}
