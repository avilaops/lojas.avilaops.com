import { prisma } from "./db";
import { resolverItensPadronizados } from "./catalogo-resolver";
import { identidadeParaRecompra, montarRevisaoRecompra } from "./recompra";

export async function consultarRecompra(tenantId: string, compradorId: string, pedidoId: string) {
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, tenantId, compradorId },
    include: { itens: true },
  });
  if (!pedido) return null;
  // A recompra negociada segue seu próprio fluxo de cotação/aprovação.
  if (pedido.empresaB2BId || pedido.cotacaoVersao || pedido.origem?.startsWith("cotacao:")) {
    return { erro: "Este pedido tem condições empresariais. Solicite uma nova cotação à loja." } as const;
  }
  const entradas = pedido.itens.flatMap(item => {
    const id = identidadeParaRecompra(item);
    return id ? [{ id, quantidade: item.quantidade }] : [];
  });
  const [ofertas, produtos] = await Promise.all([
    resolverItensPadronizados(tenantId, entradas),
    prisma.produto.findMany({ where: { tenantId, id: { in: pedido.itens.flatMap(i => i.produtoId ? [i.produtoId] : []) } }, select: { id: true, slug: true } }),
  ]);
  return { numero: pedido.numero, itens: montarRevisaoRecompra(pedido.itens, ofertas, new Map(produtos.map(p => [p.id, p.slug]))) };
}
