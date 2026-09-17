import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl } from "./mercadolivre";
import { baixarEstoqueDoPedido } from "./estoque";
import { emitir, itensParaTexto, lojista } from "./eventos";

/**
 * Venda no Mercado Livre vira pedido da loja.
 *
 * Até aqui o ML era via de mão única: a plataforma publicava anúncio e
 * empurrava preço e estoque. O que voltava — a venda — não chegava a lugar
 * nenhum. Na prática a mesma peça podia ser vendida duas vezes, porque a loja
 * só descobria o estoque a menos na próxima sincronização, e o faturamento do
 * canal não aparecia em relatório nenhum.
 *
 * O pedido do ML entra pela mesma porta dos outros: `Pedido` com
 * `canal = "mercadolivre"`, itens casados com o catálogo pelo `mlbId` do
 * anúncio, e a baixa de estoque pelo mesmo caminho do checkout
 * (`baixarEstoqueDoPedido`), que já sabe abater sem reserva prévia.
 *
 * O que **não** se inventa aqui: e-mail, telefone e documento do comprador. O
 * ML deixou de entregar dado pessoal do comprador na ordem (e o que entrega é
 * apelido e, às vezes, um e-mail de proxy). Campo sem dado fica vazio, e o
 * evento sai com `canal` para o n8n não tentar falar com quem comprou no ML
 * por fora do ML — conversa com esse comprador acontece lá dentro.
 */

/** O recorte de `GET /orders/{id}` que a plataforma usa. */
export interface OrdemMl {
  id: number | string;
  status?: string;
  status_detail?: string | null;
  date_created?: string;
  currency_id?: string;
  total_amount?: number;
  paid_amount?: number;
  order_items?: Array<{
    item?: { id?: string; title?: string; seller_sku?: string | null; seller_custom_field?: string | null; variation_id?: number | string | null };
    quantity?: number;
    unit_price?: number;
  }>;
  payments?: Array<{ id?: number | string; status?: string; payment_type?: string; shipping_cost?: number; transaction_amount?: number }>;
  shipping?: { id?: number | string | null };
  buyer?: { id?: number | string; nickname?: string; first_name?: string; last_name?: string; email?: string | null };
  cancel_detail?: { description?: string } | null;
}

export type StatusPedido = "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO";

export interface ItemMapeado {
  mlbId: string;
  produtoId: string | null;
  nome: string;
  sku: string | null;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface PedidoMlMapeado {
  canalPedidoId: string;
  referencia: string;
  status: StatusPedido;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  clienteDocumento: string;
  freteNome: string;
  freteCentavos: number;
  subtotalCentavos: number;
  totalCentavos: number;
  meioPagamento: string;
  pagamentoId: string | null;
  pagamentoStatus: string | null;
  itens: ItemMapeado[];
  /** O que o lojista precisa saber e o código não resolve sozinho. */
  avisos: string[];
}

/** Reais do ML → centavos inteiros, a moeda da casa (AGENTS.md). */
function centavos(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Status do ML → status do pedido.
 *
 * `paid` é o único que baixa estoque. `confirmed` e `payment_in_process` ainda
 * podem não virar venda, e tratá-los como pagos tiraria do ar um item que
 * continua disponível.
 */
export function statusDoPedidoMl(status: string | undefined): StatusPedido {
  if (status === "paid") return "PAGO";
  if (status === "cancelled" || status === "invalid") return "CANCELADO";
  return "AGUARDANDO_PAGAMENTO";
}

/** Forma de pagamento do ML no vocabulário da casa; o que não se reconhece vai cru. */
export function meioDePagamentoMl(tipo: string | undefined): string {
  if (!tipo) return "mercadolivre";
  if (tipo === "credit_card" || tipo === "debit_card") return "cartao";
  if (tipo === "ticket") return "boleto";
  if (tipo === "pix" || tipo === "bank_transfer") return "pix";
  if (tipo === "account_money") return "saldo-ml";
  return tipo;
}

/**
 * Traduz a ordem do ML para o pedido da loja.
 *
 * Função pura: recebe a ordem e um casamento de MLB → produto, e não toca em
 * rede nem banco. É onde mora a aritmética de dinheiro, que é o que não pode
 * errar.
 */
export function mapearPedidoMl(
  ordem: OrdemMl,
  casar: (mlbId: string) => { produtoId: string; sku: string | null } | undefined,
): PedidoMlMapeado {
  const avisos: string[] = [];
  const itens: ItemMapeado[] = [];

  for (const linha of ordem.order_items ?? []) {
    const mlbId = String(linha.item?.id ?? "").trim();
    const quantidade = Math.trunc(Number(linha.quantity ?? 0));
    if (!mlbId || quantidade < 1) {
      avisos.push("A ordem trouxe uma linha sem anúncio ou sem quantidade; ela ficou de fora do pedido.");
      continue;
    }
    const casado = casar(mlbId);
    if (!casado) {
      avisos.push(`O anúncio ${mlbId} não está ligado a nenhum produto desta loja: o item entrou no pedido sem baixar estoque.`);
    }
    if (linha.item?.variation_id) {
      avisos.push(`O anúncio ${mlbId} vendeu uma variação do Mercado Livre; confira qual apresentação sair do estoque.`);
    }
    itens.push({
      mlbId,
      produtoId: casado?.produtoId ?? null,
      nome: String(linha.item?.title ?? mlbId).slice(0, 200),
      sku: linha.item?.seller_sku ?? linha.item?.seller_custom_field ?? casado?.sku ?? null,
      quantidade,
      precoUnitarioCentavos: centavos(linha.unit_price),
    });
  }

  const pago = (ordem.payments ?? []).find((p) => p.status === "approved") ?? (ordem.payments ?? [])[0];
  const frete = centavos(pago?.shipping_cost ?? 0);
  const subtotal = itens.reduce((soma, i) => soma + i.precoUnitarioCentavos * i.quantidade, 0);
  // `total_amount` do ML é a soma dos itens, sem frete. O total da casa inclui
  // o frete, como em qualquer outro pedido — senão o relatório do canal fica
  // menor do que a venda foi.
  const total = centavos(ordem.total_amount ?? 0) + frete;
  if (total !== subtotal + frete) {
    avisos.push("A soma dos itens não bate com o total informado pelo Mercado Livre; confira antes de faturar.");
  }

  const comprador = ordem.buyer ?? {};
  const nome = [comprador.first_name, comprador.last_name].filter(Boolean).join(" ").trim();
  const status = statusDoPedidoMl(ordem.status);
  if (status === "CANCELADO" && ordem.cancel_detail?.description) {
    avisos.push(`Cancelado no Mercado Livre: ${ordem.cancel_detail.description}`);
  }

  return {
    canalPedidoId: String(ordem.id),
    referencia: `ML-${ordem.id}`,
    status,
    clienteNome: nome || comprador.nickname || "Comprador do Mercado Livre",
    // Sem inventar: o ML não entrega mais contato do comprador na ordem.
    clienteEmail: comprador.email ?? "",
    clienteTelefone: "",
    clienteDocumento: "",
    freteNome: ordem.shipping?.id ? "Mercado Envios" : "Combinado no Mercado Livre",
    freteCentavos: frete,
    subtotalCentavos: subtotal,
    totalCentavos: total,
    meioPagamento: meioDePagamentoMl(pago?.payment_type),
    pagamentoId: pago?.id != null ? String(pago.id) : null,
    pagamentoStatus: pago?.status ?? null,
    itens,
    avisos,
  };
}

/**
 * Busca a ordem no ML e grava o pedido, uma vez só.
 *
 * A notificação do ML diz "a ordem X mudou", nunca o que mudou: por isso o
 * recurso é sempre relido da API antes de qualquer efeito.
 */
export async function registrarPedidoMl(loja: Tenant, ordemId: string) {
  const ordem = await chamarMl<OrdemMl>(loja, `/orders/${encodeURIComponent(ordemId)}`);
  const mlbIds = [...new Set((ordem.order_items ?? []).map((i) => String(i.item?.id ?? "")).filter(Boolean))];
  const anuncios = mlbIds.length
    ? await prisma.anuncioMercadoLivre.findMany({
        where: { tenantId: loja.id, mlbId: { in: mlbIds } },
        select: { mlbId: true, produtoId: true, produto: { select: { sku: true } } },
      })
    : [];
  const porMlb = new Map(anuncios.map((a) => [a.mlbId!, { produtoId: a.produtoId, sku: a.produto.sku }]));
  const mapeado = mapearPedidoMl(ordem, (mlb) => porMlb.get(mlb));

  const existente = await prisma.pedido.findUnique({
    where: { tenantId_canal_canalPedidoId: { tenantId: loja.id, canal: "mercadolivre", canalPedidoId: mapeado.canalPedidoId } },
    select: { id: true, status: true, estoqueBaixado: true, numero: true, referencia: true },
  });

  const pedido = existente
    ? await prisma.pedido.update({
        where: { id: existente.id },
        data: { status: mapeado.status, pagamentoStatus: mapeado.pagamentoStatus, pagamentoId: mapeado.pagamentoId },
        select: { id: true, numero: true, referencia: true, estoqueBaixado: true },
      })
    : await prisma.pedido.create({
        data: {
          tenantId: loja.id,
          canal: "mercadolivre",
          canalPedidoId: mapeado.canalPedidoId,
          referencia: mapeado.referencia,
          status: mapeado.status,
          clienteNome: mapeado.clienteNome,
          clienteEmail: mapeado.clienteEmail,
          clienteTelefone: mapeado.clienteTelefone,
          clienteDocumento: mapeado.clienteDocumento,
          freteNome: mapeado.freteNome,
          freteCentavos: mapeado.freteCentavos,
          subtotalCentavos: mapeado.subtotalCentavos,
          totalCentavos: mapeado.totalCentavos,
          meioPagamento: mapeado.meioPagamento,
          gateway: "mercadolivre",
          pagamentoId: mapeado.pagamentoId,
          pagamentoStatus: mapeado.pagamentoStatus,
          itens: {
            create: mapeado.itens.map((i) => ({
              produtoId: i.produtoId,
              nome: i.nome,
              sku: i.sku,
              quantidade: i.quantidade,
              precoUnitarioCentavos: i.precoUnitarioCentavos,
            })),
          },
        },
        select: { id: true, numero: true, referencia: true, estoqueBaixado: true },
      });

  // Estoque só sai quando o ML confirma o pagamento, e uma vez só: o próprio
  // `baixarEstoqueDoPedido` desiste quando já baixou.
  let estoqueBaixado = pedido.estoqueBaixado;
  if (mapeado.status === "PAGO" && !pedido.estoqueBaixado) {
    await baixarEstoqueDoPedido(pedido.id);
    estoqueBaixado = true;
    const itens = mapeado.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, precoCentavos: i.precoUnitarioCentavos }));
    await emitir({
      tipo: "pedido.pago",
      slug: loja.slug,
      referencia: pedido.referencia,
      numero: pedido.numero,
      totalCentavos: mapeado.totalCentavos,
      clienteNome: mapeado.clienteNome,
      clienteEmail: mapeado.clienteEmail,
      clienteTelefone: mapeado.clienteTelefone,
      itens,
      itensTexto: itensParaTexto(itens),
      ...lojista(loja),
    });
  }

  return { pedidoId: pedido.id, referencia: pedido.referencia, novo: !existente, status: mapeado.status, estoqueBaixado, avisos: mapeado.avisos };
}
