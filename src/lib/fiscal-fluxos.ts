import type { DocumentoFiscalLoja, Prisma } from "@prisma/client";
import { eventIdDaChave } from "./eventos";
import { dadosParaFluxoFiscal } from "./fiscal-fluxos-contrato";

/** Mesma transação do documento e do cursor: nenhum recebimento fica sem fila por uma queda. */
export async function enfileirarFluxosFiscais(
  tx: Prisma.TransactionClient, tenantId: string, documentos: DocumentoFiscalLoja[],
  opcoes: { fluxoId?: string; solicitadoPor?: string } = {},
) {
  const fluxos = await tx.fluxoFiscalLoja.findMany({
    where: { tenantId, ativo: true, ...(opcoes.fluxoId ? { id: opcoes.fluxoId } : {}), tenant: { status: "ATIVA", plano: "LOJA_PRO" }, webhook: { tenantId, ativo: true } },
  });
  let enfileirados = 0;
  for (const doc of documentos) {
    if (doc.tenantId !== tenantId) throw new Error("Documento de outra loja.");
    for (const fluxo of fluxos) {
      const projecao = dadosParaFluxoFiscal(doc, fluxo.campos);
      if (!projecao || !fluxo.eventos.includes(projecao.tipo)) continue;
      // A trava dura mais que os 30 dias de retenção da fila e também protege cliques concorrentes.
      const meu = await tx.documentoFiscalLoja.updateMany({
        where: { id: doc.id, tenantId, NOT: { fluxosEnfileirados: { has: fluxo.id } } },
        data: { fluxosEnfileirados: { push: fluxo.id } },
      });
      if (!meu.count) continue;
      const eventId = eventIdDaChave(projecao.tipo, tenantId, JSON.stringify([doc.cnpj, doc.nsu, fluxo.id]));
      const corpo = {
        id: eventId, versao: 1, tipo: projecao.tipo, criadoEm: new Date().toISOString(),
        correlationId: `fiscal:${doc.id}`, tenantId,
        fluxo: { id: fluxo.id, nome: fluxo.nome, finalidade: fluxo.finalidade, configuradoPor: fluxo.criadoPor, solicitadoPor: opcoes.solicitadoPor ?? null },
        controle: { modo: "REVISAO", exigeConfirmacaoFinanceira: true, exigeConfirmacaoEstoque: true, exigeConfirmacaoProdutos: true },
        dados: projecao.dados,
      };
      await tx.entregaWebhook.create({ data: { tenantId, webhookId: fluxo.webhookId, eventId, tipo: projecao.tipo, corpo: corpo as unknown as Prisma.InputJsonValue } });
      enfileirados++;
    }
  }
  return enfileirados;
}
