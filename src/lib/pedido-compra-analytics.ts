/** Somente estados com pagamento confirmado permitem registrar uma compra. */
export function compraConfirmadaParaAnalytics(status: string): boolean {
  return ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"].includes(status);
}
