/**
 * O gateway respondeu, e a resposta foi "não": nada foi criado do lado de lá.
 *
 * Existe para separar dois casos que vinham juntos. Tempo-limite e queda de
 * conexão não dizem se a cobrança nasceu, e por isso o estoque fica reservado
 * até alguém conferir. Uma recusa com resposta (cartão inválido, dado faltando,
 * credencial errada) é conclusiva: segurar a reserva por causa dela é tirar da
 * vitrine um produto que ninguém comprou.
 *
 * O campo é atribuído no corpo do construtor, e não declarado como parameter
 * property, pelo mesmo motivo de `PedidoInvalidoError`: o pacote roda direto no
 * `node`, sem passo de build.
 */
export class CobrancaRecusada extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CobrancaRecusada";
    this.status = status;
  }
}

/**
 * A resposta HTTP do gateway é conclusiva de que nada foi cobrado?
 *
 * 4xx é o gateway recusando o pedido como veio. 408 fica de fora: é tempo
 * esgotado do lado dele, e não diz o que aconteceu com o que já tinha chegado.
 * 5xx também não é conclusivo.
 */
export function recusaConclusiva(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408;
}
