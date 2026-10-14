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
   * A cobrança que existe para esta referência de pedido, ou `null`.
   *
   * É o que responde à pergunta que o tempo-limite deixa em aberto: "a cobrança
   * chegou a nascer?". Sem isto, a tentativa que estourou o tempo ficava com o
   * estoque reservado para sempre, porque ninguém tinha o id do pagamento para
   * consultar. Havendo mais de uma, devolve a aprovada; senão, a mais recente.
   */
  buscarPorReferencia(referencia: string): Promise<ResultadoPagamento | null>;

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

/**
 * Identificador estável do provedor. Vai para o banco (`Pedido.gateway`,
 * credenciais), para a URL do webhook e para os nomes das flags: não renomear.
 */
export const PROVEDORES = ["mercadopago", "pagbank", "pagarme", "cielo", "pix_manual"] as const;
export type ProvedorId = (typeof PROVEDORES)[number];

export function ehProvedor(valor: unknown): valor is ProvedorId {
  return typeof valor === "string" && (PROVEDORES as readonly string[]).includes(valor);
}

/** O que o provedor sabe fazer. A tela e o checkout perguntam isto, nunca o nome. */
export interface Capacidades {
  pix: boolean;
  cartao: boolean;
  boleto: boolean;
  /** Estorno pela API; falso = o lojista devolve por fora e registra. */
  estorno: boolean;
  estornoParcial: boolean;
  /** O provedor avisa por webhook. Falso = só conciliação periódica ou baixa manual. */
  webhook: boolean;
  /** O pagamento se confirma sozinho. Falso = `aguardando_confirmacao` até a baixa manual. */
  confirmacaoAutomatica: boolean;
}

/**
 * Como montar um provedor para uma loja.
 *
 * `segredos` e `publicos` são o conteúdo da credencial da loja: segredos já
 * decifrados (só servidor), públicos podendo ir ao navegador (chave pública de
 * tokenização, MerchantId). Cada provedor define e valida as próprias chaves.
 */
export interface ContextoProvedor {
  segredos: Record<string, string | undefined>;
  publicos: Record<string, string | undefined>;
  /** URL completa do webhook desta loja/credencial, quando o provedor aceita por cobrança. */
  notificationUrl?: string;
  /** Nome curto da loja para a fatura do cartão (já saneado, até 13 caracteres). */
  descritorFatura?: string;
}

/**
 * Como o lojista liga o provedor, e portanto que tela a Recebimento mostra:
 * - `oauth`: botão "Conectar com {nome}" (Mercado Pago hoje; PagBank Connect).
 * - `chave`: o lojista cola as chaves seguindo `guia`, e "Testar conexão"
 *   valida antes de salvar (Pagar.me, Cielo).
 * - `pix_direto`: só a chave Pix e o nome do recebedor (ver `validarChavePix`).
 */
export type TipoConexao = "oauth" | "chave" | "pix_direto";

/** Situação de uma credencial na tela: Conectado / Erro / Pendente. */
export type StatusCredencial = "conectado" | "erro" | "pendente";

/** Campo que o lojista preenche numa conexão `chave` ou `pix_direto`. */
export interface CampoCredencial {
  /** Chave em `segredos` ou `publicos` do ContextoProvedor. */
  chave: string;
  rotulo: string;
  /** Segredo: cifrado no banco e nunca mostrado de volta. */
  segredo: boolean;
  obrigatorio: boolean;
  ajuda?: string;
}

/** Um passo do "onde acho isto" para conexões por chave. */
export interface PassoGuia {
  texto: string;
  url?: string;
}

/** Resultado de `testarConexao`. Mensagens em português simples, prontas para a tela. */
export type ResultadoTesteConexao =
  | { ok: true; mensagem: string; conta?: string; avisos: string[] }
  | { ok: false; mensagem: string; avisos: string[] };

export interface DefinicaoProvedor {
  id: ProvedorId;
  /** Nome para o lojista ("Mercado Pago", "PagBank"). */
  nome: string;
  capacidades: Capacidades;
  tipoConexao: TipoConexao;
  /** Campos da tela, para `chave` e `pix_direto`. Vazio para `oauth`. */
  campos: CampoCredencial[];
  /** Passo a passo de onde achar as chaves, para `chave`. */
  guia: PassoGuia[];
  /** Monta o adaptador. Lança se faltar credencial obrigatória. */
  criar(ctx: ContextoProvedor): PaymentProvider;
  /**
   * Confere a credencial no provedor, sem cobrar nada. A tela chama antes de
   * salvar e o status da credencial vem daqui: ok → "conectado", falha →
   * "erro" com a `mensagem`. Não lança: erro de rede vira `ok: false`.
   */
  testarConexao(ctx: ContextoProvedor): Promise<ResultadoTesteConexao>;
}
