/**
 * Situação de um pedido na lista do painel. Uma regra só para a tabela
 * (desktop) e os cartões (celular): Pix que o cliente avisou e a loja ainda
 * não conferiu aparece como "Pix a conferir", não como "Aguardando pagamento".
 */
export function situacaoNaLista(
  p: { status: string; pixAConferir?: boolean },
  rotulos: Record<string, string>,
): { rotulo: string; pixAConferir: boolean } {
  if (p.status === "AGUARDANDO_PAGAMENTO" && p.pixAConferir) return { rotulo: "Pix a conferir", pixAConferir: true };
  return { rotulo: rotulos[p.status] ?? p.status, pixAConferir: false };
}
