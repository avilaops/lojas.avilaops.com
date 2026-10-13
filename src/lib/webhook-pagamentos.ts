import { Prisma, type CredencialPagamento, type Tenant } from "@prisma/client";
import { prisma } from "./db";
import { atualizarStatusPagamento } from "./pedidos";

/**
 * Idempotência do webhook genérico de pagamentos.
 *
 * A chave é o que o provedor confirmou na reconsulta (provedor, pagamento,
 * status e valor), não o id da notificação: provedores diferentes numeram
 * avisos de jeitos diferentes, e reenvio do mesmo fato não pode virar dois
 * e-mails nem duas baixas de estoque. Fato novo (estorno depois de aprovado)
 * tem chave nova e passa.
 */
export function chaveDaNotificacao(provedor: string, pagamentoId: string, status: string, valorEmCentavos: number): string {
  return `pagamentos:${provedor}:${pagamentoId}:${status}:${valorEmCentavos}`;
}

export type Processamento = "processada" | "repetida";

export async function processarNotificacao(
  t: Tenant,
  c: Pick<CredencialPagamento, "provedor">,
  n: { pagamentoId: string; status: string; valorEmCentavos: number },
): Promise<Processamento> {
  const chave = chaveDaNotificacao(c.provedor, n.pagamentoId, n.status, n.valorEmCentavos);
  let evento = await prisma.cobrancaEvento.findUnique({ where: { notificacaoId: chave } });
  if (evento?.processadoEm) return "repetida";
  if (!evento) {
    try {
      evento = await prisma.cobrancaEvento.create({ data: { notificacaoId: chave, tenantId: t.id, topico: `pagamento:${c.provedor}` } });
    } catch (erro) {
      // Dois avisos iguais ao mesmo tempo: o outro está processando.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return "repetida";
      throw erro;
    }
  }
  try {
    await atualizarStatusPagamento(t, n.pagamentoId, n.status, n.valorEmCentavos);
    await prisma.cobrancaEvento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: null } });
    return "processada";
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await prisma.cobrancaEvento.update({ where: { id: evento.id }, data: { erro: mensagem.slice(0, 2000) } }).catch(() => {});
    throw erro;
  }
}
