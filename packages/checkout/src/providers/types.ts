import type { PedidoCheckout, ResultadoPagamento, StatusPagamento } from "../core/types.ts";

/**
 * Contrato que todo gateway precisa cumprir.
 *
 * A tela conhece só esta interface. Trocar Mercado Pago por outro provedor, ou
 * usar provedores diferentes por cliente, é implementar isto de novo , sem
 * tocar em componente nenhum.
 *
 * Tudo aqui roda no SERVIDOR. O access token do gateway dá poder de cobrar e
 * de estornar; exposto no navegador, é dinheiro na mão de quem abrir o
 * DevTools. O navegador só recebe a chave pública, usada para tokenizar cartão.
 */
export interface PaymentProvider {
  /** Nome curto, para log e conciliação. */
  readonly nome: string;

  /**
   * Cria a cobrança.
   *
   * Recebe o pedido já validado e o total recalculado no servidor , nunca o
   * total que veio da tela.
   */
  cobrar(pedido: PedidoCheckout, totalEmCentavos: number): Promise<ResultadoPagamento>;

  /** Consulta o status atual, para a tela do PIX saber quando foi pago. */
  consultar(pagamentoId: string): Promise<ResultadoPagamento>;

  /**
   * Estorna, total ou parcialmente.
   *
   * Não é enfeite: a política de devolução publicada promete reembolso pelo
   * mesmo meio de pagamento, em até 10 dias úteis. Sem isto no contrato, todo
   * reembolso vira alguém abrindo o painel do gateway na mão , que é onde
   * nasce reembolso esquecido e reembolso em duplicidade.
   *
   * Parcial existe porque devolução de um item de um pedido com cinco é o caso
   * comum; estornar tudo devolveria também o que o cliente ficou.
   */
  estornar(
    pagamentoId: string,
    opcoes?: { valorEmCentavos?: number; motivo?: string },
  ): Promise<ResultadoPagamento>;

  /**
   * Valida a assinatura do webhook e devolve o ID do pagamento notificado.
   *
   * Devolve `null` quando a assinatura não confere. Webhook sem validação de
   * assinatura é um endpoint público que qualquer um chama dizendo "pagou".
   */
  validarWebhook(entrada: WebhookEntrada): Promise<{ pagamentoId: string } | null>;
}

export interface WebhookEntrada {
  /** Corpo cru, exatamente como chegou. Assinatura não sobrevive a re-serialização. */
  corpoBruto: string;
  cabecalhos: Record<string, string | undefined>;
  /** Query string da notificação, quando o gateway usa. */
  query?: Record<string, string | undefined>;
}

/** Status do gateway já traduzido para o nosso vocabulário. */
export type MapeamentoStatus = Record<string, StatusPagamento>;
