import type { PedidoStatus, Prisma, Tenant } from "@prisma/client";
import { montarPedidoSeguro, type PayloadCheckout, type ResolucaoCatalogo } from "@avilaops/checkout/server";
import { calcularTotais, type PedidoCheckout } from "@avilaops/checkout";
import { liberarReservas } from "./catalogo-reservas";
import { prisma } from "./db";
import { emitir, itensParaTexto } from "./eventos";
import { baixarEstoqueDoPedido } from "./estoque";
import { marcarConvertido } from "./carrinhos";
import { urlDaLoja } from "./tenant";
import { COOKIE_SESSAO } from "./atribuicao";

function lojista(t: Tenant) {
  return { lojaNome: t.nome, lojaUrl: urlDaLoja(t), lojistaWhatsapp: t.whatsapp, lojistaEmail: t.loginEmail ?? t.emailContato, emailRemetente: t.emailRemetente };
}

/**
 * Persistência do pedido. O total gravado é o recalculado pelo pacote — o
 * mesmo que foi cobrado — nunca o que veio do navegador.
 */
export async function registrarPedido(
  t: Tenant,
  dados: { referencia: string; pagamentoId: string; status: string; total: number; payload: PayloadCheckout; catalogo: ResolucaoCatalogo; cupomCodigo?: string | null; compradorId?: string | null; pedidoResolvido?: PedidoCheckout },
) {
  // O snapshot usado para cobrar é o que se grava; a reserva já reduziu a oferta pública.
  const pedido = dados.pedidoResolvido ?? (await montarPedidoSeguro(dados.payload, dados.catalogo)).pedido;
  const totais = calcularTotais({ itens: pedido.itens, frete: pedido.frete, desconto: pedido.desconto ?? 0 });

  const salvo = await prisma.pedido.upsert({
    where: { referencia: pedido.referencia, tenantId: t.id },
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
      cupomCodigo: dados.cupomCodigo ?? null,
      compradorId: dados.compradorId ?? null,
      sessaoId: await sessaoDaVitrine(t.id),
      meioPagamento: pedido.meioPagamento,
      pagamentoId: dados.pagamentoId,
      pagamentoStatus: dados.status,
      status: dados.status === "aprovado" ? "PAGO" : "AGUARDANDO_PAGAMENTO",
      itens: {
        create: pedido.itens.map((i) => {
          const [produtoId, varianteId] = i.id.split(":");
          const [, varianteNome] = varianteId ? i.nome.split(/ [·—] /) : [null, null];
          return { produtoId, varianteId: varianteId ?? null, varianteNome: varianteNome ?? null, nome: i.nome, sku: i.sku, quantidade: i.quantidade, precoUnitarioCentavos: i.precoUnitario };
        }),
      },
    },
  });

  if (dados.status === "aprovado") await baixarEstoqueDoPedido(salvo.id);
  if (["recusado", "cancelado"].includes(dados.status)) await liberarReservas(t.id, pedido.referencia);

  // Comprador logado que digitou um endereço novo: guarda para a próxima compra.
  if (dados.compradorId && pedido.entrega) {
    const e = pedido.entrega;
    const cep = e.cep.replace(/\D/g, "");
    const jaTem = await prisma.enderecoComprador.findFirst({ where: { compradorId: dados.compradorId, cep, numero: e.numero } });
    if (!jaTem) {
      const primeiro = (await prisma.enderecoComprador.count({ where: { compradorId: dados.compradorId } })) === 0;
      await prisma.enderecoComprador.create({
        data: { compradorId: dados.compradorId, cep, logradouro: e.logradouro, numero: e.numero, complemento: e.complemento ?? null, bairro: e.bairro, cidade: e.cidade, uf: e.uf.toUpperCase(), principal: primeiro },
      });
    }
  }
  await marcarConvertido(pedido.referencia);

  await emitir({
    tipo: "pedido.criado",
    slug: t.slug,
    referencia: pedido.referencia,
    numero: salvo.numero,
    totalCentavos: totais.total,
    meioPagamento: pedido.meioPagamento,
    clienteNome: `${pedido.cliente.nome} ${pedido.cliente.sobrenome}`.trim(),
    clienteEmail: pedido.cliente.email,
    clienteTelefone: pedido.cliente.telefone,
    ...lojista(t),
  });
}

const MAPA: Record<string, PedidoStatus | undefined> = {
  aprovado: "PAGO",
  recusado: "CANCELADO",
  cancelado: "CANCELADO",
  estornado: "ESTORNADO",
};

/**
 * Aplica ao pedido o que o gateway respondeu sobre o pagamento.
 *
 * `valorEmCentavos` vem da CONSULTA ao gateway, nunca do corpo da notificação,
 * e é conferido contra o total do pedido antes de dar por pago. Sem essa
 * conferência o vínculo seria só o id do pagamento, e um pagamento de um real
 * confirmaria um pedido de quinhentos.
 *
 * A busca já filtra por `tenantId`: pagamento de uma loja não encosta no
 * pedido de outra, mesmo que os ids coincidissem.
 */
export async function atualizarStatusPagamento(
  t: Tenant,
  pagamentoId: string,
  status: string,
  valorEmCentavos?: number,
) {
  const pedido = await prisma.pedido.findFirst({ where: { tenantId: t.id, pagamentoId }, include: { itens: true } });
  if (!pedido) return;

  const novo = MAPA[status];

  /**
   * Valor divergente não confirma pedido.
   *
   * Só bloqueia a passagem para PAGO: estorno e cancelamento continuam
   * valendo, porque o cliente não pode ficar preso a um pedido que o gateway
   * já desfez. A divergência é registrada no `pagamentoStatus` para aparecer
   * na conciliação, em vez de sumir num log.
   */
  if (novo === "PAGO" && valorEmCentavos != null && valorEmCentavos !== pedido.totalCentavos) {
    console.error(
      `[lojas] ${t.slug}: pagamento ${pagamentoId} veio com ${valorEmCentavos} e o pedido ${pedido.referencia} soma ${pedido.totalCentavos}. Pedido NÃO confirmado.`,
    );
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { pagamentoStatus: `divergencia:${status}:${valorEmCentavos}` },
    });
    return;
  }
  // Pedido já em separação/enviado não volta para "pago" por webhook repetido.
  const avancaDeAguardando = pedido.status === "AGUARDANDO_PAGAMENTO";
  await prisma.pedido.update({
    where: { id: pedido.id },
    data: { pagamentoStatus: status, ...(novo && (avancaDeAguardando || novo === "ESTORNADO") ? { status: novo } : {}) },
  });

  if (novo === "PAGO" && !pedido.estoqueBaixado) {
    await baixarEstoqueDoPedido(pedido.id);
    const itens = pedido.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, precoCentavos: i.precoUnitarioCentavos }));
    await emitir({
      tipo: "pedido.pago", slug: t.slug, referencia: pedido.referencia, numero: pedido.numero, totalCentavos: pedido.totalCentavos,
      clienteNome: pedido.clienteNome, clienteEmail: pedido.clienteEmail, clienteTelefone: pedido.clienteTelefone,
      itens, itensTexto: itensParaTexto(itens), ...lojista(t),
    });
  } else if (["recusado", "cancelado"].includes(status) && avancaDeAguardando) {
    await liberarReservas(t.id, pedido.referencia);
    // Só quando a recusa MUDA o pedido. Sem a condição, cada reenvio da mesma
    // notificação (o Mercado Pago reenvia até receber 2xx) mandava de novo
    // "pagamento recusado" ao cliente, e uma recusa atrasada chegando depois do
    // pagamento aprovado avisava recusa de um pedido já pago.
    if (status === "recusado") await emitir({ tipo: "pedido.recusado", slug: t.slug, referencia: pedido.referencia, clienteNome: pedido.clienteNome, clienteEmail: pedido.clienteEmail, clienteTelefone: pedido.clienteTelefone, ...lojista(t) });
  }
}

/**
 * De que sessão da vitrine veio esta compra.
 *
 * Lê o cookie de medição no momento em que o pedido é gravado. Nulo em tudo
 * que não veio do site (webhook, marketplace, importação), em cookie recusado
 * e em pedido anterior à medição — e a atribuição conta esses como "Direto"
 * em vez de inventar canal. Ver src/lib/atribuicao.ts.
 *
 * Falha em silêncio de propósito: `cookies()` lança fora do escopo de uma
 * requisição, e uma venda nunca pode falhar por causa de um relatório.
 */
async function sessaoDaVitrine(tenantId: string): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const chave = (await cookies()).get(COOKIE_SESSAO)?.value;
    if (!chave) return null;
    const sessao = await prisma.sessaoVitrine.findFirst({ where: { chave, tenantId }, select: { id: true } });
    return sessao?.id ?? null;
  } catch {
    return null;
  }
}
