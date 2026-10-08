import { formatarBRL } from "./totais.ts";
import type { Centavos } from "./types.ts";

/**
 * Pedido mínimo da loja.
 *
 * A conta é uma só e mora aqui porque o carrinho (para avisar) e o servidor
 * (para recusar) precisam chegar à mesma resposta: aviso que diz "faltam
 * R$ 10" e servidor que recusa por R$ 12 é pior do que não avisar.
 *
 * O que se compara é o subtotal dos PRODUTOS, sem frete e antes do cupom, o
 * mesmo critério do "frete grátis acima de". Frete não ajuda a atingir o
 * mínimo, e cupom não tira o pedido dele: quem pôs o valor em produtos no
 * carrinho cumpriu a regra.
 *
 * Mínimo nulo, zero, negativo ou que não é número inteiro vale como "sem
 * mínimo". Dado estragado não pode trancar o checkout de uma loja.
 */
export interface SituacaoPedidoMinimo {
  /** O mínimo em vigor, ou nulo quando a loja não tem. */
  minimo: Centavos | null;
  atingido: boolean;
  /** Quanto falta em produtos. Zero quando atingido ou sem mínimo. */
  falta: Centavos;
}

export function avaliarPedidoMinimo(
  subtotal: Centavos,
  minimo: Centavos | null | undefined,
): SituacaoPedidoMinimo {
  if (minimo == null || !Number.isInteger(minimo) || minimo <= 0) {
    return { minimo: null, atingido: true, falta: 0 };
  }
  const falta = Math.max(0, minimo - subtotal);
  return { minimo, atingido: falta === 0, falta };
}

/**
 * A frase que o cliente lê, igual no carrinho e na recusa do servidor.
 * Nula quando não há o que avisar.
 */
export function avisoDePedidoMinimo(situacao: SituacaoPedidoMinimo): string | null {
  if (situacao.minimo == null || situacao.atingido) return null;
  return `Pedido mínimo de ${formatarBRL(situacao.minimo)} em produtos. Faltam ${formatarBRL(situacao.falta)}.`;
}
