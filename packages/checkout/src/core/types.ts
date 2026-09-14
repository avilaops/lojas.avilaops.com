// Tipos do checkout, independentes de gateway.
//
// Nada aqui menciona Mercado Pago. É esse isolamento que permite trocar de
// provedor , ou rodar dois ao mesmo tempo, um por cliente , sem reescrever a
// tela. O adaptador do gateway traduz destes tipos para os dele.

/**
 * Valores monetários em CENTAVOS, inteiros, sempre.
 *
 * Nunca float. `0.1 + 0.2` em JavaScript dá 0.30000000000000004, e num carrinho
 * com dez itens esse resíduo vira divergência de um centavo entre o total que a
 * tela mostra e o valor que o gateway cobra , que é exatamente o tipo de
 * diferença que gera chargeback e conciliação manual.
 */
export type Centavos = number;

export interface ItemCarrinho {
  /** Identificador estável do produto. Use o mesmo do feed do Merchant Center. */
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: Centavos;
  imagem?: string;
  sku?: string;
  /** Peso em gramas, quando o frete for calculado por peso. */
  pesoGramas?: number;
}

export interface Cliente {
  nome: string;
  sobrenome: string;
  email: string;
  /** Só dígitos: DDD + número. */
  telefone: string;
  /** Só dígitos: CPF (11) ou CNPJ (14). */
  documento: string;
}

export interface EnderecoEntrega {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface OpcaoFrete {
  id: string;
  nome: string;
  preco: Centavos;
  /** Prazo em dias úteis, para exibir "chega em X dias úteis". */
  prazoDiasUteis: number;
}

/**
 * Retirada na loja é uma opção de frete com preço zero, não um caso especial.
 *
 * Tratar como frete comum evita um `if (retirada)` espalhado por total,
 * validação de endereço e resumo do pedido.
 */
export const FRETE_RETIRADA_ID = "retirada-na-loja";

export type MeioPagamento = "pix" | "cartao" | "boleto";

export interface DadosCartao {
  /**
   * Token gerado NO NAVEGADOR pelo SDK do gateway.
   *
   * O número do cartão nunca passa por este código nem pelo nosso servidor. É
   * isso que mantém a operação fora do escopo pesado do PCI-DSS: quem toca em
   * PAN é o SDK do gateway, dentro do navegador do cliente.
   */
  token: string;
  parcelas: number;
  /** Identificador da bandeira que o próprio SDK detectou. */
  bandeira?: string;
  /** E-mail do titular, quando difere do e-mail do cliente. */
  emailTitular?: string;
}

export interface PedidoCheckout {
  /** Idempotência: repetir o mesmo pedido não pode gerar duas cobranças. */
  referencia: string;
  itens: ItemCarrinho[];
  cliente: Cliente;
  entrega?: EnderecoEntrega;
  frete: OpcaoFrete;
  meioPagamento: MeioPagamento;
  cartao?: DadosCartao;
  /** Desconto já calculado, em centavos. */
  desconto?: Centavos;
}

export type StatusPagamento =
  | "pendente"
  | "em_analise"
  | "aprovado"
  | "recusado"
  | "estornado"
  | "cancelado";

export interface ResultadoPagamento {
  /** ID do pagamento no gateway, para conciliação e suporte. */
  id: string;
  status: StatusPagamento;
  meioPagamento: MeioPagamento;
  valor: Centavos;
  /** Motivo da recusa, em português, quando houver. */
  motivo?: string;
  /** Dados do PIX, quando o meio for PIX. */
  pix?: {
    /** Payload copia-e-cola do BR Code. */
    copiaECola: string;
    /** QR code em PNG base64, pronto para <img src="data:image/png;base64,...">. */
    qrCodeBase64?: string;
    /** Quando a cobrança expira. */
    expiraEm?: string;
  };
  /** Link do boleto, quando o meio for boleto. */
  boleto?: {
    url: string;
    linhaDigitavel?: string;
    vencimento?: string;
  };
}

/** Totais do pedido. Uma função só calcula, para tela e servidor nunca divergirem. */
export interface TotaisPedido {
  subtotal: Centavos;
  frete: Centavos;
  desconto: Centavos;
  total: Centavos;
  quantidadeItens: number;
}
