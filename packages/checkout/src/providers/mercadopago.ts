import { createHmac, timingSafeEqual } from "node:crypto";
import type { PedidoCheckout, ResultadoPagamento, StatusPagamento } from "../core/types.ts";
import { apenasDigitos, tipoDocumento } from "../core/brasil.ts";
import type { MapeamentoStatus, PaymentProvider, WebhookEntrada } from "./types.ts";
import { CobrancaRecusada, recusaConclusiva } from "./erros.ts";

const API = "https://api.mercadopago.com";

/**
 * Tempo-limite das chamadas. Sem ele, um Mercado Pago que pendura a conexão
 * prende a requisição do checkout até o proxy desistir e trava a reconciliação
 * no primeiro pedido do laço.
 *
 * Estourar NÃO quer dizer que a cobrança não foi criada: o `fetch` rejeita, o
 * método rejeita e quem chama decide (o checkout marca a tentativa como incerta
 * e mantém a reserva; a chave de idempotência protege a nova tentativa). Por
 * isso cobrança e estorno têm folga, e não se baixa este número para "responder
 * mais rápido".
 */
const TEMPO_LIMITE_COBRANCA_MS = 20_000;
const TEMPO_LIMITE_ESTORNO_MS = 20_000;
/** Leitura simples, repetida em laço pela reconciliação: falha cedo e segue. */
const TEMPO_LIMITE_CONSULTA_MS = 10_000;

/**
 * Status do Mercado Pago traduzidos.
 *
 * `in_process` e `in_mediation` viram "em_analise" e NÃO "aprovado": é análise
 * antifraude ou disputa aberta. Tratar como pago aqui significa despachar
 * mercadoria de uma compra que ainda pode ser recusada.
 */
const STATUS: MapeamentoStatus = {
  pending: "pendente",
  in_process: "em_analise",
  in_mediation: "em_analise",
  authorized: "em_analise",
  approved: "aprovado",
  rejected: "recusado",
  cancelled: "cancelado",
  refunded: "estornado",
  charged_back: "estornado",
};

/** Recusas mais comuns, em português , a mensagem crua do MP é código interno. */
const MOTIVOS: Record<string, string> = {
  cc_rejected_insufficient_amount: "Cartão sem limite disponível.",
  cc_rejected_bad_filled_security_code: "Código de segurança incorreto.",
  cc_rejected_bad_filled_date: "Data de validade incorreta.",
  cc_rejected_bad_filled_other: "Dados do cartão incorretos.",
  cc_rejected_call_for_authorize: "Autorize a compra com o seu banco e tente de novo.",
  cc_rejected_card_disabled: "Cartão desabilitado. Fale com o seu banco.",
  cc_rejected_high_risk: "Pagamento recusado pela análise de risco. Tente outro meio.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro.",
  cc_rejected_duplicated_payment: "Já existe um pagamento igual em andamento.",
};

export interface MercadoPagoConfig {
  /** Access token PRIVADO. Servidor apenas. */
  accessToken: string;
  /** Segredo da assinatura de webhook, do painel do Mercado Pago. */
  webhookSecret?: string;
  /** Prefixo na descrição da fatura do cliente. Ex.: "BRILHAX". */
  descritorFatura?: string;
  /** Minutos até a cobrança PIX expirar. */
  pixExpiraEmMinutos?: number;
  /** URL do webhook da loja para esta cobranca. */
  notificationUrl?: string;
}

/**
 * Adaptador do Mercado Pago via API de Pagamentos (Checkout Transparente).
 *
 * Escolha deliberada de NÃO usar o Checkout Pro: o Pro redireciona o cliente
 * para uma tela do Mercado Pago, o que descaracteriza a marca e nos tira o
 * controle da conversão. Aqui a tela é nossa e o Mercado Pago entra só como
 * trilho de liquidação , o cartão é tokenizado no navegador pelo SDK deles,
 * então o número nunca toca o nosso servidor.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly nome = "mercadopago";

  // Campo declarado e atribuído no corpo, e não `constructor(private config)`:
  // parameter property exige transformação de código, então o Node se recusa a
  // executar o arquivo direto. Assim o pacote roda sem passo de build.
  private readonly config: MercadoPagoConfig;

  constructor(config: MercadoPagoConfig) {
    if (!config.accessToken) {
      throw new Error("MercadoPagoProvider exige accessToken.");
    }
    this.config = config;
  }

  async cobrar(pedido: PedidoCheckout, totalEmCentavos: number): Promise<ResultadoPagamento> {
    const corpo = this.montarCorpo(pedido, totalEmCentavos);

    const resposta = await fetch(`${API}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        "content-type": "application/json",
        // Idempotência: o cliente que clica duas vezes, ou a rede que repete o
        // POST, não pode gerar duas cobranças. A referência do pedido é a chave.
        "x-idempotency-key": pedido.referencia,
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_COBRANCA_MS),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      // Erro de validação do MP vem com 400 e uma lista em `cause`. Sem isso no
      // log, "pagamento falhou" é impossível de diagnosticar depois.
      const detalhe = dados?.cause?.[0]?.description ?? dados?.message ?? "erro desconhecido";
      const mensagem = `Mercado Pago recusou a cobrança (${resposta.status}): ${detalhe}`;
      // 4xx é conclusivo: nada foi criado, e quem chamou pode soltar o estoque.
      // 5xx e 408 seguem como erro comum, que quem chamou trata como incerto.
      if (recusaConclusiva(resposta.status)) throw new CobrancaRecusada(mensagem, resposta.status);
      throw new Error(mensagem);
    }

    return this.traduzir(dados);
  }

  async buscarPorReferencia(referencia: string): Promise<ResultadoPagamento | null> {
    const consulta = new URLSearchParams({ external_reference: referencia, sort: "date_created", criteria: "desc", limit: "10" });
    const resposta = await fetch(`${API}/v1/payments/search?${consulta}`, {
      headers: { authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE_CONSULTA_MS),
    });

    if (!resposta.ok) {
      throw new Error(`Não foi possível buscar o pagamento da referência ${referencia}.`);
    }

    const dados = await resposta.json();
    // A busca do MP casa por prefixo em alguns campos; só vale o que tem
    // exatamente esta referência.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exatos = (Array.isArray(dados?.results) ? dados.results : []).filter((r: any) => r?.external_reference === referencia);
    if (exatos.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aprovado = exatos.find((r: any) => r.status === "approved");
    return this.traduzir(aprovado ?? exatos[0]);
  }

  async consultar(pagamentoId: string): Promise<ResultadoPagamento> {
    const resposta = await fetch(`${API}/v1/payments/${pagamentoId}`, {
      headers: { authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE_CONSULTA_MS),
    });

    if (!resposta.ok) {
      throw new Error(`Não foi possível consultar o pagamento ${pagamentoId}.`);
    }

    return this.traduzir(await resposta.json());
  }

  async estornar(
    pagamentoId: string,
    opcoes: { valorEmCentavos?: number; motivo?: string } = {},
  ): Promise<ResultadoPagamento> {
    // Estorno parcial manda `amount`; total manda corpo vazio. Enviar
    // `amount: null` faz o MP recusar, então o campo some quando não há valor.
    const corpo =
      opcoes.valorEmCentavos != null
        ? { amount: Number((opcoes.valorEmCentavos / 100).toFixed(2)) }
        : {};

    const resposta = await fetch(`${API}/v1/payments/${pagamentoId}/refunds`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        "content-type": "application/json",
        // Sem idempotência, um clique duplo no painel estorna duas vezes , e o
        // segundo estorno sai do caixa da loja.
        "x-idempotency-key": `refund:${pagamentoId}:${opcoes.valorEmCentavos ?? "total"}`,
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_ESTORNO_MS),
    });

    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      const detalhe = dados?.message ?? `HTTP ${resposta.status}`;
      throw new Error(`Estorno recusado pelo Mercado Pago: ${detalhe}`);
    }

    // A resposta do refund descreve o estorno, não o pagamento. Quem interessa
    // para o pedido é o estado final do pagamento, então consultamos de novo.
    return this.consultar(pagamentoId);
  }

  /**
   * Valida a assinatura `x-signature` do webhook.
   *
   * O Mercado Pago assina o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
   * com HMAC-SHA256. A comparação é feita em tempo constante: comparar hash com
   * `===` vaza, pelo tempo de resposta, quantos bytes iniciais bateram, e isso
   * é o bastante para forjar assinatura byte a byte.
   */
  async validarWebhook(entrada: WebhookEntrada): Promise<{ pagamentoId: string } | null> {
    const { webhookSecret } = this.config;
    if (!webhookSecret) {
      throw new Error(
        "webhookSecret não configurado , sem ele o endpoint aceita qualquer notificação de pagamento.",
      );
    }

    const assinatura = entrada.cabecalhos["x-signature"];
    const requestId = entrada.cabecalhos["x-request-id"];
    if (!assinatura || !requestId) return null;

    const partes = Object.fromEntries(
      assinatura.split(",").map((p) => {
        const [chave, valor] = p.split("=");
        return [chave?.trim(), valor?.trim()];
      }),
    ) as Record<string, string | undefined>;

    const ts = partes.ts;
    const hashRecebido = partes.v1;
    if (!ts || !hashRecebido) return null;

    let corpo: { data?: { id?: string | number }; type?: string };
    try {
      corpo = JSON.parse(entrada.corpoBruto);
    } catch {
      return null;
    }

    const dataId = corpo?.data?.id ?? entrada.query?.["data.id"];
    if (!dataId) return null;

    // O MP normaliza o id para minúsculas no manifesto.
    const manifesto = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
    const esperado = createHmac("sha256", webhookSecret).update(manifesto).digest("hex");

    const a = Buffer.from(esperado, "utf8");
    const b = Buffer.from(hashRecebido, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return { pagamentoId: String(dataId) };
  }

  // ── privado ───────────────────────────────────────────────────────────────

  private montarCorpo(pedido: PedidoCheckout, totalEmCentavos: number) {
    const documento = apenasDigitos(pedido.cliente.documento);
    const tipo = tipoDocumento(documento);

    const base = {
      // A API do Mercado Pago recebe REAIS decimais, não centavos. Mandar
      // centavos aqui cobra cem vezes o valor , e o erro passa no teste feliz,
      // porque a cobrança é aceita normalmente.
      transaction_amount: Number((totalEmCentavos / 100).toFixed(2)),
      description: this.descricao(pedido),
      external_reference: pedido.referencia,
      notification_url: this.config.notificationUrl,
      statement_descriptor: this.config.descritorFatura,
      payer: {
        email: pedido.cliente.email,
        first_name: pedido.cliente.nome,
        last_name: pedido.cliente.sobrenome,
        ...(tipo ? { identification: { type: tipo, number: documento } } : {}),
      },
    };

    if (pedido.meioPagamento === "pix") {
      const minutos = this.config.pixExpiraEmMinutos ?? 30;
      return {
        ...base,
        payment_method_id: "pix",
        date_of_expiration: new Date(Date.now() + minutos * 60_000).toISOString(),
      };
    }

    if (pedido.meioPagamento === "boleto") {
      return { ...base, payment_method_id: "bolbradesco" };
    }

    if (!pedido.cartao?.token) {
      throw new Error("Pagamento com cartão exige o token gerado pelo SDK no navegador.");
    }

    return {
      ...base,
      token: pedido.cartao.token,
      installments: pedido.cartao.parcelas,
      ...(pedido.cartao.bandeira ? { payment_method_id: pedido.cartao.bandeira } : {}),
    };
  }

  /** Descrição que o cliente vê na fatura e no extrato do PIX. */
  private descricao(pedido: PedidoCheckout): string {
    const primeiro = pedido.itens[0];
    if (!primeiro) return `Pedido ${pedido.referencia}`;
    const restantes = pedido.itens.length - 1;
    return restantes > 0
      ? `${primeiro.nome} e mais ${restantes} ${restantes === 1 ? "item" : "itens"}`
      : primeiro.nome;
  }

  // Resposta crua do Mercado Pago: campos aninhados e opcionais, lidos com `?.`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private traduzir(dados: Record<string, any>): ResultadoPagamento {
    const status: StatusPagamento = STATUS[dados.status] ?? "pendente";
    const pix = dados?.point_of_interaction?.transaction_data;

    return {
      id: String(dados.id),
      status,
      meioPagamento:
        dados.payment_method_id === "pix"
          ? "pix"
          : dados.payment_type_id === "ticket"
            ? "boleto"
            : "cartao",
      valor: Math.round(Number(dados.transaction_amount ?? 0) * 100),
      ...(status === "recusado"
        ? {
            motivo:
              MOTIVOS[dados.status_detail] ??
              "Pagamento não autorizado. Tente outro cartão ou outro meio de pagamento.",
          }
        : {}),
      ...(pix?.qr_code
        ? {
            pix: {
              copiaECola: pix.qr_code,
              qrCodeBase64: pix.qr_code_base64,
              expiraEm: dados.date_of_expiration,
            },
          }
        : {}),
      ...(dados.transaction_details?.external_resource_url
        ? {
            boleto: {
              url: dados.transaction_details.external_resource_url,
              linhaDigitavel: dados.barcode?.content,
              vencimento: dados.date_of_expiration,
            },
          }
        : {}),
    };
  }
}
