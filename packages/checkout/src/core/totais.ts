import type { Centavos, ItemCarrinho, OpcaoFrete, TotaisPedido } from "./types.ts";

/**
 * Total do pedido, em centavos inteiros.
 *
 * Esta função é a única fonte do total, e é usada tanto pela tela quanto pelo
 * servidor antes de cobrar. Isso não é preciosismo de arquitetura: se a tela
 * calcula o total e manda para o servidor, qualquer pessoa com o DevTools aberto
 * compra por R$ 0,01. O servidor recalcula com esta mesma função a partir dos
 * IDs e das quantidades, e compara com o que o cliente viu.
 */
export function calcularTotais({
  itens,
  frete,
  desconto = 0,
}: {
  itens: ItemCarrinho[];
  frete?: OpcaoFrete | null;
  desconto?: Centavos;
}): TotaisPedido {
  const subtotal = itens.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0,
  );

  const valorFrete = frete?.preco ?? 0;
  // Desconto nunca deixa o total negativo , cupom maior que o carrinho
  // zera o pedido em vez de virar crédito, que nenhum gateway aceita cobrar.
  const descontoAplicado = Math.min(desconto, subtotal);

  return {
    subtotal,
    frete: valorFrete,
    desconto: descontoAplicado,
    total: subtotal + valorFrete - descontoAplicado,
    quantidadeItens: itens.reduce((soma, item) => soma + item.quantidade, 0),
  };
}

/** Centavos para "R$ 1.234,56". */
export function formatarBRL(centavos: Centavos): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Parcelas exibidas no cartão.
 *
 * `valorMinimoParcela` existe porque parcelar R$ 40,00 em 12x produz parcela de
 * R$ 3,33 , que o adquirente costuma recusar e que gera custo de transação
 * maior que a própria parcela. O padrão de R$ 5,00 é conservador.
 */
export function opcoesDeParcelamento({
  total,
  maxParcelas = 12,
  valorMinimoParcela = 500,
}: {
  total: Centavos;
  maxParcelas?: number;
  valorMinimoParcela?: Centavos;
}): Array<{ parcelas: number; valorParcela: Centavos; rotulo: string }> {
  const opcoes: Array<{ parcelas: number; valorParcela: Centavos; rotulo: string }> = [];

  for (let n = 1; n <= maxParcelas; n += 1) {
    const valorParcela = Math.floor(total / n);
    if (n > 1 && valorParcela < valorMinimoParcela) break;

    opcoes.push({
      parcelas: n,
      valorParcela,
      rotulo:
        n === 1
          ? `À vista , ${formatarBRL(total)}`
          : `${n}x de ${formatarBRL(valorParcela)} sem juros`,
    });
  }

  return opcoes;
}
