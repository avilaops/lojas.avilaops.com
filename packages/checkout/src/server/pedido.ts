import { calcularTotais } from "../core/totais.ts";
import { validarCelular, validarDocumento, apenasDigitos } from "../core/brasil.ts";
import type {
  Centavos,
  ItemCarrinho,
  MeioPagamento,
  OpcaoFrete,
  PedidoCheckout,
} from "../core/types.ts";
import { FRETE_RETIRADA_ID } from "../core/types.ts";

/**
 * O que o navegador manda.
 *
 * Repare no que NÃO está aqui: preço, subtotal e total. O cliente informa o que
 * quer comprar , quanto custa é decisão do servidor. Aceitar preço vindo da
 * tela é aceitar que qualquer pessoa com o DevTools aberto defina o valor da
 * compra.
 */
export interface PayloadCheckout {
  referencia: string;
  itens: Array<{ id: string; quantidade: number }>;
  cliente: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone: string;
    documento: string;
  };
  entrega: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
  } | null;
  freteId: string;
  meioPagamento: MeioPagamento;
  parcelas?: number;
  cartaoToken?: string;
  bandeira?: string;
  /**
   * Total que a tela exibiu, em centavos.
   *
   * Não é usado para cobrar , é conferido contra o total recalculado. Serve
   * para detectar preço que mudou entre a montagem do carrinho e o pagamento, e
   * assim recusar a compra em vez de cobrar um valor diferente do que a pessoa
   * viu e concordou.
   */
  totalExibido?: Centavos;
}

export interface ResolucaoCatalogo {
  /** Resolve preço e nome atuais a partir dos IDs. Fonte: o seu catálogo. */
  resolverItens: (
    ids: Array<{ id: string; quantidade: number }>,
  ) => Promise<ItemCarrinho[]>;
  /** Fretes válidos para este pedido. Recotados no servidor, não confiados. */
  resolverFretes: (contexto: {
    itens: ItemCarrinho[];
    cep: string | null;
  }) => Promise<OpcaoFrete[]>;
  /** Desconto de cupom, se houver. Sempre calculado aqui. */
  resolverDesconto?: (contexto: { itens: ItemCarrinho[] }) => Promise<Centavos>;
}

export type CodigoPedidoInvalido =
  | "carrinho_vazio"
  | "item_indisponivel"
  | "frete_invalido"
  | "cliente_invalido"
  | "endereco_obrigatorio"
  | "total_divergente"
  | "cartao_sem_token";

/**
 * O campo é atribuído no corpo do construtor, não declarado como parameter
 * property (`constructor(readonly codigo)`).
 *
 * Parameter property é sintaxe que o TypeScript precisa *transformar*, não só
 * apagar , e o Node se recusa a executar o arquivo. Escrito assim, o pacote
 * roda direto no `node` e no `node --test`, sem passo de build.
 */
export class PedidoInvalidoError extends Error {
  readonly codigo: CodigoPedidoInvalido;

  constructor(message: string, codigo: CodigoPedidoInvalido) {
    super(message);
    this.name = "PedidoInvalidoError";
    this.codigo = codigo;
  }
}

/**
 * Monta o pedido confiável a partir do payload do navegador.
 *
 * Toda validação que a tela já faz é refeita aqui. Isso não é redundância: a
 * validação da tela existe para a pessoa não errar; a do servidor existe porque
 * a requisição pode não ter vindo da tela.
 */
export async function montarPedidoSeguro(
  payload: PayloadCheckout,
  catalogo: ResolucaoCatalogo,
): Promise<{ pedido: PedidoCheckout; total: Centavos }> {
  if (!payload.itens?.length) {
    throw new PedidoInvalidoError("Carrinho vazio.", "carrinho_vazio");
  }

  const itens = await catalogo.resolverItens(
    payload.itens.map((i) => ({ id: i.id, quantidade: Math.max(1, Math.trunc(i.quantidade)) })),
  );

  // Item que sumiu do catálogo entre a montagem do carrinho e o pagamento não
  // pode ser ignorado em silêncio: o cliente pagaria por um pedido diferente do
  // que montou.
  if (itens.length !== payload.itens.length) {
    throw new PedidoInvalidoError(
      "Um dos produtos não está mais disponível. Revise o carrinho.",
      "item_indisponivel",
    );
  }

  const documento = apenasDigitos(payload.cliente?.documento ?? "");
  const telefone = apenasDigitos(payload.cliente?.telefone ?? "");
  if (!validarDocumento(documento)) {
    throw new PedidoInvalidoError("CPF ou CNPJ inválido.", "cliente_invalido");
  }
  if (!validarCelular(telefone)) {
    throw new PedidoInvalidoError("Celular inválido.", "cliente_invalido");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(payload.cliente?.email ?? "")) {
    throw new PedidoInvalidoError("E-mail inválido.", "cliente_invalido");
  }

  const fretes = await catalogo.resolverFretes({
    itens,
    cep: payload.entrega ? apenasDigitos(payload.entrega.cep) : null,
  });
  const frete = fretes.find((f) => f.id === payload.freteId);
  if (!frete) {
    throw new PedidoInvalidoError(
      "Forma de entrega indisponível para este pedido.",
      "frete_invalido",
    );
  }

  // Entrega só é dispensável na retirada. Sem esta checagem, um payload sem
  // endereço e com frete de entrega gera pedido para lugar nenhum.
  if (frete.id !== FRETE_RETIRADA_ID && !payload.entrega) {
    throw new PedidoInvalidoError(
      "Endereço de entrega obrigatório para esta forma de envio.",
      "endereco_obrigatorio",
    );
  }

  if (payload.meioPagamento === "cartao" && !payload.cartaoToken) {
    throw new PedidoInvalidoError(
      "Pagamento com cartão exige o token do navegador.",
      "cartao_sem_token",
    );
  }

  const desconto = (await catalogo.resolverDesconto?.({ itens })) ?? 0;
  const totais = calcularTotais({ itens, frete, desconto });

  // Divergência entre o que a pessoa viu e o que o servidor calculou é preço
  // que mudou no meio do caminho. Cobrar assim mesmo é cobrar valor não
  // acordado , melhor recusar e mandar revisar.
  if (payload.totalExibido != null && payload.totalExibido !== totais.total) {
    throw new PedidoInvalidoError(
      "O valor do pedido mudou. Revise o carrinho antes de pagar.",
      "total_divergente",
    );
  }

  const pedido: PedidoCheckout = {
    referencia: payload.referencia,
    itens,
    cliente: {
      nome: payload.cliente.nome.trim(),
      sobrenome: payload.cliente.sobrenome.trim(),
      email: payload.cliente.email.trim().toLowerCase(),
      telefone,
      documento,
    },
    ...(payload.entrega ? { entrega: payload.entrega } : {}),
    frete,
    meioPagamento: payload.meioPagamento,
    ...(payload.cartaoToken
      ? {
          cartao: {
            token: payload.cartaoToken,
            parcelas: Math.max(1, Math.trunc(payload.parcelas ?? 1)),
            ...(payload.bandeira ? { bandeira: payload.bandeira } : {}),
          },
        }
      : {}),
    desconto,
  };

  return { pedido, total: totais.total };
}
