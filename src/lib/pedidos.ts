import type { PedidoStatus, Prisma, Tenant } from "@prisma/client";
import { montarPedidoSeguro, type PayloadCheckout, type ResolucaoCatalogo } from "@avilaops/checkout/server";
import { calcularTotais } from "@avilaops/checkout";
import { prisma } from "./db";
import { emitir } from "./eventos";

/**
 * Persistência do pedido. O total gravado é o recalculado pelo pacote — o
 * mesmo que foi cobrado — nunca o que veio do navegador.
 */
export async function registrarPedido(
  t: Tenant,
  dados: { referencia: string; pagamentoId: string; status: string; total: number; payload: PayloadCheckout; catalogo: ResolucaoCatalogo },
) {
  const { pedido } = await montarPedidoSeguro(dados.payload, dados.catalogo);
  const totais = calcularTotais({ itens: pedido.itens, frete: pedido.frete, desconto: pedido.desconto ?? 0 });

  await prisma.pedido.upsert({
    where: { referencia: pedido.referencia },
    update: { pagamentoId: dados.pagamentoId, pagamentoStatus: dados.status },
    create: {
      tenantId: t.id,
      referencia: pedido.referencia,
      clienteNome: `${pedido.cliente.nome} ${pedido.cliente.sobrenome}`.trim(),
      clienteEmail: pedido.cliente.email,
      clienteTelefone: pedido.cliente.telefone,
      clienteDocumento: pedido.cliente.documento,
      entrega: pedido.entrega ? ({ ...pedido.entrega } as Prisma.InputJsonValue) : undefined,
      freteNome: pedido.frete.nome,
      freteCentavos: totais.frete,
      subtotalCentavos: totais.subtotal,
      descontoCentavos: totais.desconto,
      totalCentavos: totais.total,
      meioPagamento: pedido.meioPagamento,
      pagamentoId: dados.pagamentoId,
      pagamentoStatus: dados.status,
      status: dados.status === "aprovado" ? "PAGO" : "AGUARDANDO_PAGAMENTO",
      itens: {
        create: pedido.itens.map((i) => ({ produtoId: i.id, nome: i.nome, sku: i.sku, quantidade: i.quantidade, precoUnitarioCentavos: i.precoUnitario })),
      },
    },
  });

  await emitir({
    tipo: "pedido.criado",
    slug: t.slug,
    referencia: pedido.referencia,
    total: totais.total,
    meioPagamento: pedido.meioPagamento,
    clienteEmail: pedido.cliente.email,
    clienteTelefone: pedido.cliente.telefone,
  });
}

const MAPA: Record<string, PedidoStatus | undefined> = {
  aprovado: "PAGO",
  recusado: "CANCELADO",
  cancelado: "CANCELADO",
  estornado: "ESTORNADO",
};

export async function atualizarStatusPagamento(t: Tenant, pagamentoId: string, status: string) {
  const pedido = await prisma.pedido.findFirst({ where: { tenantId: t.id, pagamentoId } });
  if (!pedido) return;

  const novo = MAPA[status];
  // Pedido já em separação/enviado não volta para "pago" por webhook repetido.
  const avancaDeAguardando = pedido.status === "AGUARDANDO_PAGAMENTO";
  await prisma.pedido.update({
    where: { id: pedido.id },
    data: { pagamentoStatus: status, ...(novo && (avancaDeAguardando || novo === "ESTORNADO") ? { status: novo } : {}) },
  });

  if (novo === "PAGO" && avancaDeAguardando) {
    await emitir({ tipo: "pedido.pago", slug: t.slug, referencia: pedido.referencia, total: pedido.totalCentavos, clienteEmail: pedido.clienteEmail, clienteTelefone: pedido.clienteTelefone });
  } else if (status === "recusado") {
    await emitir({ tipo: "pedido.recusado", slug: t.slug, referencia: pedido.referencia });
  }
}
