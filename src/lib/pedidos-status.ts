import type { Pedido, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { urlDaLoja } from "./tenant";

/**
 * A loja avança o pedido: separar, enviar, entregar, cancelar.
 *
 * Uma função só para as três portas que fazem isso — o painel, o conector MCP
 * e a API para desenvolvedores. Eram três cópias do mesmo trecho, e a regra
 * ("não avança o que não foi pago", "avisa uma vez por virada") só vale se for
 * a mesma nas três.
 *
 * Pagamento não passa por aqui: `PAGO`, `ESTORNADO` e a recusa vêm do gateway
 * (`atualizarStatusPagamento`, em pedidos.ts).
 */
export const STATUS_QUE_A_LOJA_MUDA = ["EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"] as const;
export type StatusDaLoja = (typeof STATUS_QUE_A_LOJA_MUDA)[number];

export class MudancaDeStatusRecusada extends Error {
  constructor(
    public motivo: "nao_encontrado" | "nao_pago",
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "MudancaDeStatusRecusada";
  }
}

export interface MudancaDeStatus {
  status?: StatusDaLoja;
  /** `null` apaga o rastreio; ausente não mexe. */
  rastreio?: string | null;
}

/** Aceita o id do pedido ou a referência; sempre dentro da loja. */
export async function mudarStatusDoPedido(loja: Tenant, idOuReferencia: string, mudanca: MudancaDeStatus): Promise<{ pedido: Pedido; mudou: boolean }> {
  const pedido = await prisma.pedido.findFirst({ where: { tenantId: loja.id, OR: [{ id: idOuReferencia }, { referencia: idOuReferencia }] } });
  if (!pedido) throw new MudancaDeStatusRecusada("nao_encontrado", "Pedido não encontrado nesta loja.");
  if (pedido.status === "AGUARDANDO_PAGAMENTO" && mudanca.status && mudanca.status !== "CANCELADO") {
    throw new MudancaDeStatusRecusada("nao_pago", "Pedido ainda não foi pago; por enquanto só é possível cancelar.");
  }

  const a = await prisma.pedido.update({
    where: { id: pedido.id },
    data: { ...(mudanca.status ? { status: mudanca.status } : {}), ...(mudanca.rastreio !== undefined ? { rastreio: mudanca.rastreio || null } : {}) },
  });

  // Toda virada de situação avisa uma vez só: salvar o rastreio de novo, ou
  // marcar entregue depois, não gera um segundo e-mail. A chave do evento é o
  // que garante isso quando dois cliques (ou duas integrações) chegam juntos.
  const mudou = Boolean(mudanca.status) && mudanca.status !== pedido.status;
  if (mudou) {
    const comum = {
      slug: loja.slug,
      referencia: a.referencia,
      numero: a.numero,
      clienteNome: a.clienteNome,
      clienteEmail: a.clienteEmail,
      clienteTelefone: a.clienteTelefone,
      linkPedido: `${urlDaLoja(loja)}/pedido/${a.referencia}`,
      lojaNome: loja.nome,
      lojaUrl: urlDaLoja(loja),
      lojistaEmail: loja.loginEmail ?? loja.emailContato,
      lojistaWhatsapp: loja.whatsapp,
      emailRemetente: loja.emailRemetente,
    };
    if (mudanca.status === "EM_SEPARACAO") await emitir({ tipo: "pedido.em-separacao", ...comum }, { chave: `em-separacao:${a.referencia}` });
    if (mudanca.status === "ENVIADO") await emitir({ tipo: "pedido.enviado", transportadora: a.freteNome, rastreio: a.rastreio, ...comum }, { chave: `enviado:${a.referencia}` });
    if (mudanca.status === "ENTREGUE") await emitir({ tipo: "pedido.entregue", ...comum }, { chave: `entregue:${a.referencia}` });
    if (mudanca.status === "CANCELADO") {
      await emitir({ tipo: "pedido.cancelado", totalCentavos: a.totalCentavos, motivo: "cancelado pela loja", ...comum }, { chave: `cancelado:${a.referencia}` });
    }
  }
  return { pedido: a, mudou };
}
