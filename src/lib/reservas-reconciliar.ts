import type { PaymentProvider } from "@avilaops/checkout/server";
import type { Tenant } from "@prisma/client";
import { alertar } from "./alertas";
import { liberarReservas } from "./catalogo-reservas";
import { prisma } from "./db";
import { GatewayNaoConfigurado, providerDaLoja } from "./gateway";
import { urlDaLoja } from "./tenant";

/**
 * Resolve as tentativas de checkout que ficaram sem resposta.
 *
 * Quando a cobrança estoura o tempo, não se sabe se ela nasceu: a tentativa
 * vira `INCERTA` e o estoque fica reservado, de propósito. Até 08/10/2026 nada
 * voltava para conferir, e a reserva ficava para sempre — produto fora da
 * vitrine por causa de uma venda que não aconteceu.
 *
 * Esta rotina pergunta ao gateway pela referência do pedido:
 *
 *   - não existe cobrança, ou ela foi recusada/cancelada → solta a reserva;
 *   - existe e está pendente (Pix esperando, boleto) → espera;
 *   - existe e foi **aprovada**, sem pedido do nosso lado → não solta nada e
 *     abre alerta: dinheiro entrou e a loja não sabe.
 */

/** Antes disto o cliente ainda pode estar na tela, e o gateway ainda pode estar gravando. */
const ESPERA_MIN = 15;
/** Uma loja com muita tentativa parada não prende a rotina. */
const MAXIMO_POR_RODADA = 100;

export interface ResumoDasReservas {
  conferidas: number;
  liberadas: number;
  aguardando: number;
  pagasSemPedido: number;
  lojasSemGateway: number;
  falhas: number;
}

export type ProviderDe = (t: Tenant) => PaymentProvider;

export async function reconciliarReservas(opcoes: { agora?: Date; providerDe?: ProviderDe } = {}): Promise<ResumoDasReservas> {
  const agora = opcoes.agora ?? new Date();
  const providerDe = opcoes.providerDe ?? providerDaLoja;
  const resumo: ResumoDasReservas = { conferidas: 0, liberadas: 0, aguardando: 0, pagasSemPedido: 0, lojasSemGateway: 0, falhas: 0 };

  const tentativas = await prisma.tentativaCatalogo.findMany({
    where: { estado: "INCERTA", atualizadoEm: { lt: new Date(agora.getTime() - ESPERA_MIN * 60_000) } },
    orderBy: { atualizadoEm: "asc" },
    take: MAXIMO_POR_RODADA,
  });
  if (tentativas.length === 0) return resumo;

  const lojas = new Map((await prisma.tenant.findMany({ where: { id: { in: [...new Set(tentativas.map((t) => t.tenantId))] } } })).map((t) => [t.id, t]));

  for (const tentativa of tentativas) {
    const loja = lojas.get(tentativa.tenantId);
    if (!loja) continue;
    try {
      // Pedido já registrado é assunto de `pedidos.verificar`, que tem o id do
      // pagamento: aqui a tentativa só deixa de ser "incerta".
      if (await prisma.pedido.findUnique({ where: { referencia: tentativa.referencia }, select: { id: true } })) {
        await prisma.tentativaCatalogo.updateMany({ where: { id: tentativa.id, estado: "INCERTA" }, data: { estado: "COBRANCA_CRIADA" } });
        resumo.aguardando++;
        continue;
      }

      const pagamento = await providerDe(loja).buscarPorReferencia(tentativa.referencia);
      resumo.conferidas++;

      if (!pagamento || pagamento.status === "recusado" || pagamento.status === "cancelado" || pagamento.status === "estornado") {
        await liberarReservas(loja.id, tentativa.referencia);
        resumo.liberadas++;
      } else if (pagamento.status === "aprovado") {
        await alertar({
          codigo: "pagamento.sem-pedido", slug: loja.slug, lojaNome: loja.nome, recurso: tentativa.referencia,
          detalhe: `Pagamento ${pagamento.id} de ${pagamento.valor} centavos aprovado, sem pedido registrado.`,
          link: `${urlDaLoja(loja)}/painel/pedidos`,
        });
        // Sai da fila: o alerta já foi (uma vez só, pela chave), e consultar o
        // gateway de dez em dez minutos por um caso que espera gente não ajuda.
        await prisma.tentativaCatalogo.updateMany({ where: { id: tentativa.id, estado: "INCERTA" }, data: { estado: "PAGA_SEM_PEDIDO", pagamentoId: pagamento.id } });
        resumo.pagasSemPedido++;
      } else {
        resumo.aguardando++;
      }
    } catch (erro) {
      if (erro instanceof GatewayNaoConfigurado) {
        resumo.lojasSemGateway++;
        continue;
      }
      // Uma tentativa que falha não impede as outras; a próxima rodada tenta de novo.
      resumo.falhas++;
      console.error("[reservas] não reconciliou", tentativa.referencia, erro instanceof Error ? erro.message : erro);
    }
  }
  return resumo;
}
