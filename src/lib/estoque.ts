import { prisma } from "./db";

/**
 * Baixa de estoque quando o pedido é pago. Uma vez só por pedido
 * (`Pedido.estoqueBaixado`), mesmo que o webhook chegue repetido.
 * Estoque `null` = não controlado; nunca fica negativo.
 */
export async function baixarEstoqueDoPedido(pedidoId: string) {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { itens: true } });
  if (!pedido || pedido.estoqueBaixado) return;

  await prisma.$transaction(async (tx) => {
    for (const item of pedido.itens) {
      if (item.varianteId) {
        const v = await tx.variante.findUnique({ where: { id: item.varianteId } });
        if (v?.estoque != null) await tx.variante.update({ where: { id: v.id }, data: { estoque: Math.max(0, v.estoque - item.quantidade) } });
      } else if (item.produtoId) {
        const p = await tx.produto.findUnique({ where: { id: item.produtoId } });
        if (p?.estoque != null) {
          const novo = Math.max(0, p.estoque - item.quantidade);
          await tx.produto.update({ where: { id: p.id }, data: { estoque: novo, ...(novo === 0 ? { disponibilidade: "out_of_stock" } : {}) } });
        }
      }
    }
    if (pedido.cupomCodigo) {
      await tx.cupom.updateMany({ where: { tenantId: pedido.tenantId, codigo: pedido.cupomCodigo }, data: { usos: { increment: 1 } } });
    }
    await tx.pedido.update({ where: { id: pedido.id }, data: { estoqueBaixado: true } });
  });
}
