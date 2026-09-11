import { prisma } from "./db";
import { GatewayNaoConfigurado, providerDaLoja } from "./gateway";
import { atualizarStatusPagamento } from "./pedidos";

/**
 * Confere no gateway os pedidos que ainda aguardam pagamento.
 *
 * Até aqui a única coisa que tirava um pedido de AGUARDANDO_PAGAMENTO era o
 * webhook. Cartão aprovado nasce PAGO na hora, mas Pix e boleto dependem 100%
 * da notificação chegar, com assinatura válida, e ser processada. Se qualquer
 * uma dessas três coisas falha e o Mercado Pago desiste de reenviar, o
 * pagamento entrou na conta do lojista e o pedido nunca sai do lugar.
 *
 * Esta rotina é a segunda porta: pergunta ao gateway, pedido a pedido, e passa
 * o resultado pela MESMA função do webhook. As regras de lá valem aqui sem
 * cópia: valor conferido contra o total, estoque baixado uma vez só, aviso de
 * recusa uma vez só. Rodar duas vezes, ou junto com um webhook, não duplica
 * nada.
 */

/** Pix expira em 30 minutos e boleto em até três dias úteis: 7 dias cobre os dois com folga. */
const JANELA_DIAS = 7;

/** Teto por rodada para uma loja com muito pedido parado não prender a rotina. */
const MAXIMO_POR_RODADA = 200;

export interface ResumoReconciliacao {
  conferidos: number;
  aindaPendentes: number;
  comMudanca: number;
  lojasSemGateway: number;
  falhas: number;
}

export async function reconciliarPagamentosPendentes(agora = new Date()): Promise<ResumoReconciliacao> {
  const desde = new Date(agora.getTime() - JANELA_DIAS * 24 * 60 * 60 * 1000);

  const pedidos = await prisma.pedido.findMany({
    where: { status: "AGUARDANDO_PAGAMENTO", pagamentoId: { not: null }, criadoEm: { gte: desde } },
    include: { tenant: true },
    orderBy: { criadoEm: "asc" },
    take: MAXIMO_POR_RODADA,
  });

  const resumo: ResumoReconciliacao = { conferidos: 0, aindaPendentes: 0, comMudanca: 0, lojasSemGateway: 0, falhas: 0 };

  for (const pedido of pedidos) {
    try {
      const resultado = await providerDaLoja(pedido.tenant).consultar(pedido.pagamentoId!);
      resumo.conferidos++;

      if (resultado.status === "pendente") {
        resumo.aindaPendentes++;
        continue;
      }

      await atualizarStatusPagamento(pedido.tenant, resultado.id, resultado.status, resultado.valor);
      resumo.comMudanca++;
    } catch (erro) {
      if (erro instanceof GatewayNaoConfigurado) {
        resumo.lojasSemGateway++;
        continue;
      }
      // Um pedido que falha não para os outros. O id do pedido vai para o log;
      // o erro do gateway pode trazer detalhe da conta, então só a mensagem.
      resumo.falhas++;
      console.error(
        `[lojas] reconciliação: pedido ${pedido.referencia} (${pedido.tenant.slug}) não conferido: ${erro instanceof Error ? erro.message : "erro desconhecido"}`,
      );
    }
  }

  return resumo;
}
