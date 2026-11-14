/** Regra extraída da página do pedido para reproduzir a regressão na CI. */
export function compraConfirmadaParaAnalytics(status: string): boolean {
  return status !== "AGUARDANDO_PAGAMENTO" && status !== "CANCELADO";
}
