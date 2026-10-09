/**
 * O que o comprador vê quando o checkout respondeu `pagamento_a_confirmar`.
 *
 * Nesse desfecho não se sabe se a cobrança nasceu (tempo-limite do gateway) ou
 * ela nasceu e o pedido não foi gravado. Reabrir o formulário convida a pagar
 * de novo; o comprador vai para a página do pedido, que nesse intervalo ainda
 * não tem `Pedido` e se orienta pela tentativa (`TentativaCatalogo`). Quem
 * resolve a tentativa é a rotina `reservas.reconciliar`.
 */

export const CODIGO_A_CONFIRMAR = "pagamento_a_confirmar";

/**
 * Para onde o navegador vai depois de uma resposta não-ok do `/api/checkout`,
 * ou `null` quando o erro é do formulário e a tela continua nele. A referência
 * é a que o servidor devolveu; sem ela, a que o navegador enviou.
 */
export function destinoAposFalhaDoCheckout(corpo: unknown, referenciaEnviada: string): string | null {
  const c = (corpo ?? {}) as { codigo?: unknown; referencia?: unknown };
  if (c.codigo !== CODIGO_A_CONFIRMAR) return null;
  const referencia = typeof c.referencia === "string" && c.referencia ? c.referencia : referenciaEnviada;
  return `/pedido/${encodeURIComponent(referencia)}`;
}

export type TelaSemPedido = "confirmando" | "nao_concluido";

/**
 * A tela da página do pedido quando a referência tem tentativa e não tem
 * pedido. `null` é 404: referência que a loja não conhece, ou tentativa que
 * nunca chegou à cobrança (`RESERVADA`) nem deveria estar sem pedido
 * (`CONFIRMADA`).
 */
export function telaSemPedido(estadoDaTentativa: string | null | undefined): TelaSemPedido | null {
  switch (estadoDaTentativa) {
    case "INCERTA":
    case "COBRANCA_CRIADA":
    case "PAGA_SEM_PEDIDO":
      return "confirmando";
    case "LIBERADA":
      return "nao_concluido";
    default:
      return null;
  }
}
