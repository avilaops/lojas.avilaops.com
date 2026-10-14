import { createHash, createPublicKey, verify } from "node:crypto";
import type { PedidoCheckout, ResultadoPagamento, StatusPagamento } from "../core/types.ts";
import { apenasDigitos } from "../core/brasil.ts";
import type { PaymentProvider, WebhookEntrada } from "./types.ts";
import { CobrancaRecusada, recusaConclusiva } from "./erros.ts";

/**
 * Hosts publicados em developer.pagbank.com.br (out/2026). O nome da API
 * continua pagseguro.com.
 */
const HOSTS = {
  producao: "https://api.pagseguro.com",
  sandbox: "https://sandbox.api.pagseguro.com",
} as const;

const TEMPO_LIMITE_COBRANCA_MS = 20_000;
const TEMPO_LIMITE_ESTORNO_MS = 20_000;
const TEMPO_LIMITE_CONSULTA_MS = 10_000;

/** Boleto: a documentação exige no mínimo R$ 0,20. */
const BOLETO_MINIMO_CENTAVOS = 20;

/**
 * Status da cobrança (objeto Charge), não do pedido.
 *
 * `AUTHORIZED` é pré-autorização: o valor está reservado no cartão e ainda
 * não foi capturado. Tratar como pago despacha mercadoria de uma cobrança
 * que pode caducar sem captura. Aqui o cartão vai com `capture: true`, então
 * o caminho feliz é `PAID`; `AUTHORIZED` só aparece se o PagBank não capturar.
 */
const STATUS: Record<string, StatusPagamento> = {
  WAITING: "pendente",
  IN_ANALYSIS: "em_analise",
  AUTHORIZED: "em_analise",
  PAID: "aprovado",
  DECLINED: "recusado",
  CANCELED: "cancelado",
};

/** `reference_id` da API de Pedidos aceita no máximo 64 caracteres. */
const REFERENCIA_MAX = 64;

export interface PagBankConfig {
  /** Token da conta (Connect ou token do painel). Servidor apenas. */
  accessToken: string;
  /**
   * Chave pública X.509 em Base64 (`type=webhook`), para o header
   * `x-payload-signature`. Sem ela, `validarWebhook` consulta
   * `GET /public-keys/webhook` uma vez e guarda o resultado.
   */
  chavePublicaWebhook?: string;
  /** URL HTTPS que recebe o webhook desta cobrança. A API aceita uma só. */
  notificationUrl?: string;
  /** Nome na fatura do cartão. A API corta em 22 e tira caractere especial. */
  descritorFatura?: string;
  /** Minutos até o QR Code Pix expirar. */
  pixExpiraEmMinutos?: number;
  /** Dias corridos até o vencimento do boleto. */
  boletoVenceEmDias?: number;
  ambiente?: keyof typeof HOSTS;
}

interface LinkPagBank {
  rel?: string;
  href?: string;
  media?: string;
}

interface CobrancaPagBank {
  id?: string;
  reference_id?: string;
  status?: string;
  created_at?: string;
  amount?: {
    value?: number;
    summary?: { total?: number; paid?: number; refunded?: number };
  };
  payment_response?: { code?: string | number; message?: string };
  payment_method?: {
    type?: string;
    pix?: { expiration_date?: string };
    boleto?: { formatted_barcode?: string; barcode?: string; due_date?: string };
  };
  links?: LinkPagBank[];
  qr_code?: { text?: string };
}

interface PedidoPagBank {
  id?: string;
  reference_id?: string;
  created_at?: string;
  charges?: CobrancaPagBank[];
}

interface ErroPagBank {
  message?: string;
  error_messages?: { description?: string; error?: string; parameter_name?: string }[];
}

/**
 * Adaptador do PagBank pela API de Pedidos (Orders).
 *
 * Cartão, Pix e boleto nascem no mesmo `POST /orders`, com a cobrança já no
 * objeto `charges`. O número do cartão não entra aqui: o navegador criptografa
 * com a chave pública da conta (`PagSeguro.encryptCard`) e este servidor só
 * repassa a string `encrypted`.
 */
export class PagBankProvider implements PaymentProvider {
  readonly nome = "pagbank";

  private readonly config: PagBankConfig;
  private readonly base: string;
  /** Preenchida na primeira notificação, quando a chave não veio na config. */
  private chavePublicaWebhook?: string;

  constructor(config: PagBankConfig) {
    if (!config.accessToken) {
      throw new Error("PagBankProvider exige accessToken.");
    }
    this.config = config;
    this.base = HOSTS[config.ambiente ?? "producao"];
    this.chavePublicaWebhook = config.chavePublicaWebhook?.trim() || undefined;
  }

  async cobrar(pedido: PedidoCheckout, totalEmCentavos: number): Promise<ResultadoPagamento> {
    const corpo = this.montarPedido(pedido, totalEmCentavos);
    const resposta = await fetch(`${this.base}/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        accept: "application/json",
        "content-type": "application/json",
        // A chave é alfanumérica: a página de idempotência e o erro 40005
        // (`idempotency_key_in_use`, HTTP 409) são da API de Pedidos. O
        // OpenAPI de "Criar pedido" não lista o header; o guia de chaves sim.
        "x-idempotency-key": chaveDeIdempotencia(pedido.referencia),
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_COBRANCA_MS),
    });

    const dados = await lerJson(resposta);
    if (!resposta.ok) {
      const mensagem = `PagBank recusou a cobrança (${resposta.status}): ${detalheDoErro(dados, resposta.status)}`;
      // 409 é a chave de idempotência já usada: a primeira tentativa pode ter
      // criado a cobrança. Tratar como recusa conclusiva soltaria o estoque
      // de uma venda que talvez exista.
      if (recusaConclusiva(resposta.status) && resposta.status !== 409) {
        throw new CobrancaRecusada(mensagem, resposta.status);
      }
      throw new Error(mensagem);
    }

    return this.traduzirPedido(dados as PedidoPagBank, referenciaDaApi(pedido.referencia));
  }

  async consultar(pagamentoId: string): Promise<ResultadoPagamento> {
    const id = encodeURIComponent(pagamentoId);
    // Cobrança (`CHAR_`) é o que se estorna e o que o webhook devolve. Pedido
    // (`ORDE_`) só entra quando a notificação não trouxe a cobrança.
    const caminho = pagamentoId.startsWith("ORDE_") ? `/orders/${id}` : `/charges/${id}`;
    const resposta = await fetch(`${this.base}${caminho}`, {
      headers: { authorization: `Bearer ${this.config.accessToken}`, accept: "application/json" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_CONSULTA_MS),
    });
    if (!resposta.ok) {
      throw new Error(`Não foi possível consultar o pagamento ${pagamentoId}.`);
    }
    const dados = (await lerJson(resposta)) as PedidoPagBank & CobrancaPagBank;
    if (Array.isArray(dados.charges) || pagamentoId.startsWith("ORDE_")) {
      return this.traduzirPedido(dados, undefined);
    }
    return this.traduzirCobranca(dados);
  }

  /**
   * A página "Consultar pedido através de parâmetros" documenta só `charge_id`.
   * Não há, na referência publicada, filtro por `reference_id` — e a comunidade
   * do PagBank pergunta isso sem resposta oficial.
   *
   * A reconciliação precisa desta busca. O pedido é criado com `reference_id`
   * igual ao da cobrança, e a consulta manda esse valor. Se a API recusar o
   * parâmetro (400), isto lança: devolver `null` faria a rotina soltar o
   * estoque de uma cobrança que pode ter nascido.
   */
  async buscarPorReferencia(referencia: string): Promise<ResultadoPagamento | null> {
    const ref = referenciaDaApi(referencia);
    const consulta = new URLSearchParams({ reference_id: ref });
    const resposta = await fetch(`${this.base}/orders?${consulta}`, {
      headers: { authorization: `Bearer ${this.config.accessToken}`, accept: "application/json" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_CONSULTA_MS),
    });

    if (resposta.status === 404) return null;
    const dados = await lerJson(resposta);
    if (!resposta.ok) {
      throw new Error(`Não foi possível buscar o pagamento da referência ${referencia}.`);
    }

    const pedidos = extrairPedidos(dados);
    const exatos = pedidos.filter((p) => casaReferencia(p, ref));
    if (exatos.length === 0) return null;
    const aprovado = exatos.find((p) => (p.charges ?? []).some((c) => c.status?.toUpperCase() === "PAID"));
    const recente = [...exatos].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
    const escolhido = aprovado ?? recente;
    if (!escolhido) return null;
    return this.traduzirPedido(escolhido, ref);
  }

  async estornar(
    pagamentoId: string,
    opcoes: { valorEmCentavos?: number; motivo?: string } = {},
  ): Promise<ResultadoPagamento> {
    if (pagamentoId.startsWith("ORDE_")) {
      throw new Error("Estorno do PagBank usa o id da cobrança (CHAR_), não o do pedido.");
    }
    // O corpo documentado do cancelamento não tem motivo. O texto fica no pedido.
    const valor = await this.valorDoEstorno(pagamentoId, opcoes.valorEmCentavos);
    const resposta = await fetch(`${this.base}/charges/${encodeURIComponent(pagamentoId)}/cancel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        accept: "application/json",
        "content-type": "application/json",
        "x-idempotency-key": chaveDeIdempotencia(`estorno${pagamentoId}${valor}`),
      },
      // Centavos, inteiros. Os exemplos oficiais mandam `amount.value` tanto
      // no estorno parcial quanto no total; o total sem valor não aparece.
      body: JSON.stringify({ amount: { value: valor } }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_ESTORNO_MS),
    });

    const dados = await lerJson(resposta);
    if (!resposta.ok) {
      throw new Error(`Estorno recusado pelo PagBank: ${detalheDoErro(dados, resposta.status)}`);
    }
    // A resposta do cancelamento já é a cobrança (parcial continua PAID, com
    // `summary.refunded`; total vira CANCELED). Não precisa de uma segunda consulta.
    return this.traduzirCobranca(dados as CobrancaPagBank);
  }

  /**
   * Confere `x-payload-signature` com a chave pública do webhook.
   *
   * O modelo publicado (página "Validação de autenticidade") é ECDSA com
   * SHA-256 sobre os bytes crus do corpo. O header pode trazer mais de uma
   * assinatura na rotação de chave; uma válida basta. O modelo antigo
   * (`x-authenticity-token` = SHA-256 do token concatenado ao corpo) está
   * marcado como substituído e não é aceito aqui.
   */
  async validarWebhook(entrada: WebhookEntrada): Promise<{ pagamentoId: string } | null> {
    const assinaturas = assinaturasDoHeader(cabecalho(entrada, "x-payload-signature"));
    if (assinaturas.length === 0) return null;

    const chave = await this.chaveDoWebhook();
    const corpo = Buffer.from(entrada.corpoBruto, "utf8");
    const autentica = assinaturas.some((assinatura) => assinaturaConfere(corpo, chave, assinatura));
    if (!autentica) return null;

    let json: unknown;
    try {
      json = JSON.parse(entrada.corpoBruto);
    } catch {
      return null;
    }
    const id = idNotificado(json);
    return id ? { pagamentoId: id } : null;
  }

  // ── privado ───────────────────────────────────────────────────────────────

  private montarPedido(pedido: PedidoCheckout, totalEmCentavos: number): Record<string, unknown> {
    if (!Number.isInteger(totalEmCentavos) || totalEmCentavos <= 0) {
      throw new CobrancaRecusada("O valor da cobrança precisa ser um inteiro de centavos maior que zero.", 400);
    }
    const referencia = referenciaDaApi(pedido.referencia);
    const notificacao = urlDeNotificacao(this.config.notificationUrl);
    return {
      reference_id: referencia,
      customer: cliente(pedido),
      items: pedido.itens.map((item) => ({
        reference_id: item.id.slice(0, REFERENCIA_MAX),
        name: item.nome.slice(0, 100),
        quantity: item.quantidade,
        unit_amount: item.precoUnitario,
      })),
      ...(pedido.entrega ? { shipping: { address: endereco(pedido.entrega, "BRA") } } : {}),
      ...(notificacao ? { notification_urls: [notificacao] } : {}),
      charges: [this.cobranca(pedido, totalEmCentavos, referencia)],
    };
  }

  private cobranca(pedido: PedidoCheckout, totalEmCentavos: number, referencia: string): Record<string, unknown> {
    const base = {
      reference_id: referencia,
      description: descricao(pedido).slice(0, 64),
      amount: { value: totalEmCentavos, currency: "BRL" },
    };

    if (pedido.meioPagamento === "pix") {
      const minutos = this.config.pixExpiraEmMinutos ?? 30;
      return {
        ...base,
        payment_method: {
          type: "PIX",
          pix: { expiration_date: new Date(Date.now() + minutos * 60_000).toISOString() },
        },
      };
    }

    if (pedido.meioPagamento === "boleto") {
      if (totalEmCentavos < BOLETO_MINIMO_CENTAVOS) {
        throw new CobrancaRecusada("O boleto do PagBank exige no mínimo R$ 0,20.", 400);
      }
      if (!pedido.entrega) {
        throw new CobrancaRecusada("O boleto do PagBank exige o endereço de quem paga.", 400);
      }
      const dias = this.config.boletoVenceEmDias ?? 3;
      return {
        ...base,
        payment_method: {
          type: "BOLETO",
          boleto: {
            due_date: dataEmSaoPaulo(dias),
            instruction_lines: {
              line_1: "Pague ate a data de vencimento",
              line_2: "Pedido da loja",
            },
            holder: {
              name: nomeCliente(pedido).slice(0, 120),
              tax_id: apenasDigitos(pedido.cliente.documento),
              email: pedido.cliente.email,
              address: endereco(pedido.entrega, "Brasil"),
            },
          },
        },
      };
    }

    const cifrado = cartaoCifrado(pedido.cartao?.token);
    const parcelas = pedido.cartao?.parcelas ?? 0;
    if (!Number.isInteger(parcelas) || parcelas < 1) {
      throw new CobrancaRecusada("Informe em quantas vezes o cartão será cobrado.", 400);
    }
    const fatura = descritor(this.config.descritorFatura);
    return {
      ...base,
      payment_method: {
        type: "CREDIT_CARD",
        installments: parcelas,
        capture: true,
        ...(fatura ? { soft_descriptor: fatura } : {}),
        // Só o criptograma. `store: false` para o PagBank não guardar o cartão.
        card: { encrypted: cifrado, store: false },
      },
    };
  }

  private async valorDoEstorno(pagamentoId: string, informado: number | undefined): Promise<number> {
    if (informado != null) {
      if (!Number.isInteger(informado) || informado <= 0) {
        throw new Error("O valor do estorno precisa ser um inteiro de centavos maior que zero.");
      }
      return informado;
    }
    // Estorno sem valor devolve o que ainda resta (total menos o já devolvido).
    // Numa cobrança intacta isso é o valor original, que é o que os exemplos
    // oficiais mandam em `amount.value`.
    const atual = await this.consultar(pagamentoId);
    if (atual.valor <= 0) {
      throw new Error("A cobrança não tem valor restante para estornar.");
    }
    return atual.valor;
  }

  private async chaveDoWebhook(): Promise<string> {
    if (this.chavePublicaWebhook) return this.chavePublicaWebhook;
    const resposta = await fetch(`${this.base}/public-keys/webhook`, {
      headers: { authorization: `Bearer ${this.config.accessToken}`, accept: "application/json" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_CONSULTA_MS),
    });
    const dados = (await lerJson(resposta)) as { public_key?: string };
    const chave = typeof dados.public_key === "string" ? dados.public_key.trim() : "";
    if (!resposta.ok || !chave) {
      throw new Error(
        "Chave pública do webhook PagBank indisponível. Sem ela a notificação não é conferida.",
      );
    }
    this.chavePublicaWebhook = chave;
    return chave;
  }

  private traduzirPedido(pedido: PedidoPagBank, referencia: string | undefined): ResultadoPagamento {
    const cobranca = escolherCobranca(pedido.charges ?? [], referencia);
    if (!cobranca?.id) {
      throw new Error("PagBank respondeu sem cobrança para traduzir.");
    }
    return this.traduzirCobranca(cobranca);
  }

  private traduzirCobranca(cobranca: CobrancaPagBank): ResultadoPagamento {
    if (!cobranca.id) {
      throw new Error("PagBank respondeu sem o id da cobrança.");
    }
    const statusBruto = cobranca.status?.toUpperCase() ?? "";
    const devolvido = cobranca.amount?.summary?.refunded ?? 0;
    const total = cobranca.amount?.summary?.total ?? cobranca.amount?.value ?? 0;
    let status: StatusPagamento = STATUS[statusBruto] ?? "pendente";
    // Estorno total vem como CANCELED com `summary.refunded`. Estorno parcial
    // permanece PAID e o status da cobrança não muda: o que foi pago continua
    // pago, e `valor` abaixo é o que ainda resta.
    if (devolvido > 0 && (statusBruto === "CANCELED" || (total > 0 && devolvido >= total))) {
      status = "estornado";
    }

    const tipo = cobranca.payment_method?.type?.toUpperCase();
    const meio = tipo === "PIX" ? "pix" : tipo === "BOLETO" ? "boleto" : "cartao";
    const restante = Math.max(0, total - devolvido);
    const pixTexto = cobranca.qr_code?.text;
    const pdf =
      cobranca.links?.find((l) => l.media === "application/pdf" && l.href)?.href ??
      cobranca.links?.find((l) => l.media === "image/png" && l.rel === "SELF" && l.href)?.href;

    return {
      id: cobranca.id,
      status,
      meioPagamento: meio,
      valor: restante,
      ...(status === "recusado"
        ? { motivo: "Pagamento não autorizado. Tente outro cartão ou outro meio de pagamento." }
        : {}),
      ...(meio === "pix" && pixTexto
        ? {
            pix: {
              copiaECola: pixTexto,
              expiraEm: cobranca.payment_method?.pix?.expiration_date,
            },
          }
        : {}),
      ...(meio === "boleto" && (pdf || cobranca.payment_method?.boleto?.formatted_barcode)
        ? {
            boleto: {
              url: pdf ?? "",
              linhaDigitavel: cobranca.payment_method?.boleto?.formatted_barcode ?? cobranca.payment_method?.boleto?.barcode,
              vencimento: cobranca.payment_method?.boleto?.due_date,
            },
          }
        : {}),
    };
  }
}

/** O que a API grava e o que a busca precisa repetir, byte a byte. */
export function referenciaDaApi(referencia: string): string {
  const limpa = referencia.trim();
  if (limpa.length >= 1 && limpa.length <= REFERENCIA_MAX) return limpa;
  return createHash("sha256").update(limpa).digest("hex");
}

/**
 * A documentação da retentativa pede chave alfanumérica, sem caractere
 * especial, com no máximo 200. Hífen de referência vira o código do caractere,
 * para "PED-1" não colidir com "PED1".
 */
export function chaveDeIdempotencia(valor: string): string {
  return valor.replace(/[^0-9A-Za-z]/g, (c) => c.charCodeAt(0).toString(16)).slice(0, 200);
}

function nomeCliente(pedido: PedidoCheckout): string {
  return `${pedido.cliente.nome} ${pedido.cliente.sobrenome}`.trim();
}

function cliente(pedido: PedidoCheckout): Record<string, unknown> {
  const telefone = telefonePagBank(pedido.cliente.telefone);
  return {
    name: nomeCliente(pedido).slice(0, 120),
    email: pedido.cliente.email,
    tax_id: apenasDigitos(pedido.cliente.documento),
    ...(telefone ? { phones: [telefone] } : {}),
  };
}

function telefonePagBank(telefone: string): { country: string; area: string; number: string; type: "MOBILE" } | undefined {
  let digitos = apenasDigitos(telefone);
  if (digitos.startsWith("55") && digitos.length >= 12) digitos = digitos.slice(2);
  if (digitos.length < 10) return undefined;
  return { country: "55", area: digitos.slice(0, 2), number: digitos.slice(2), type: "MOBILE" };
}

function endereco(
  entrega: NonNullable<PedidoCheckout["entrega"]>,
  pais: string,
): Record<string, string> {
  return {
    street: entrega.logradouro,
    number: entrega.numero,
    ...(entrega.complemento ? { complement: entrega.complemento } : {}),
    locality: entrega.bairro,
    city: entrega.cidade,
    region: entrega.uf,
    region_code: entrega.uf,
    country: pais,
    postal_code: apenasDigitos(entrega.cep),
  };
}

function descricao(pedido: PedidoCheckout): string {
  const primeiro = pedido.itens[0];
  if (!primeiro) return `Pedido ${pedido.referencia}`;
  const restantes = pedido.itens.length - 1;
  return restantes > 0
    ? `${primeiro.nome} e mais ${restantes} ${restantes === 1 ? "item" : "itens"}`
    : primeiro.nome;
}

function descritor(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const limpo = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9A-Za-z ]/g, "")
    .trim()
    .slice(0, 22);
  return limpo || undefined;
}

function dataEmSaoPaulo(diasAFrente: number): string {
  const alvo = new Date(Date.now() + diasAFrente * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(alvo);
}

function urlDeNotificacao(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("https://")) return undefined;
  return url;
}

/**
 * Recusa PAN, JSON de cartão e string curta demais para ser o criptograma
 * do SDK. O texto do erro não ecoa o que chegou.
 */
function cartaoCifrado(token: string | undefined): string {
  const valor = token?.trim() ?? "";
  const recusa = "Pagamento com cartão exige o cartão criptografado no navegador. O número do cartão não pode chegar ao servidor.";
  if (valor.length < 80) throw new CobrancaRecusada(recusa, 400);
  if (/^\d{13,19}$/.test(valor.replace(/\s/g, ""))) throw new CobrancaRecusada(recusa, 400);
  if (/security_code|"number"|exp_month/i.test(valor)) throw new CobrancaRecusada(recusa, 400);
  return valor;
}

function escolherCobranca(cobrancas: CobrancaPagBank[], referencia: string | undefined): CobrancaPagBank | undefined {
  const daReferencia = referencia ? cobrancas.filter((c) => c.reference_id === referencia) : [];
  const base = daReferencia.length > 0 ? daReferencia : cobrancas;
  const paga = base.find((c) => c.status?.toUpperCase() === "PAID");
  if (paga) return paga;
  return [...base].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
}

function casaReferencia(pedido: PedidoPagBank, referencia: string): boolean {
  if (pedido.reference_id === referencia) return true;
  return (pedido.charges ?? []).some((c) => c.reference_id === referencia);
}

function extrairPedidos(dados: unknown): PedidoPagBank[] {
  if (Array.isArray(dados)) return dados as PedidoPagBank[];
  if (!dados || typeof dados !== "object") {
    throw new Error("Resposta de busca do PagBank em formato desconhecido.");
  }
  const corpo = dados as { orders?: unknown; results?: unknown; id?: unknown; charges?: unknown; reference_id?: unknown };
  if (Array.isArray(corpo.orders)) return corpo.orders as PedidoPagBank[];
  if (Array.isArray(corpo.results)) return corpo.results as PedidoPagBank[];
  if (typeof corpo.id === "string" || typeof corpo.reference_id === "string" || Array.isArray(corpo.charges)) {
    return [corpo as PedidoPagBank];
  }
  throw new Error("Resposta de busca do PagBank em formato desconhecido.");
}

function idNotificado(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const corpo = dados as PedidoPagBank & { id?: string };
  const cobranca = escolherCobranca(corpo.charges ?? [], undefined);
  if (cobranca?.id) return cobranca.id;
  if (typeof corpo.id === "string" && (corpo.id.startsWith("CHAR_") || corpo.id.startsWith("ORDE_"))) return corpo.id;
  return null;
}

function cabecalho(entrada: WebhookEntrada, nome: string): string | undefined {
  const alvo = nome.toLowerCase();
  for (const [chave, valor] of Object.entries(entrada.cabecalhos)) {
    if (chave.toLowerCase() === alvo && valor) return valor;
  }
  return undefined;
}

function assinaturasDoHeader(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((parte) => parte.trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function assinaturaConfere(corpo: Buffer, chavePublica: string, assinaturaBase64: string): boolean {
  try {
    const pem = chavePublica.includes("BEGIN PUBLIC KEY") ? chavePublica : pemDaChave(chavePublica);
    const chave = createPublicKey(pem);
    const assinatura = Buffer.from(assinaturaBase64, "base64");
    if (assinatura.length === 0) return false;
    return verify("sha256", corpo, chave, assinatura);
  } catch {
    return false;
  }
}

function pemDaChave(base64: string): string {
  const linhas = base64.replace(/\s/g, "").match(/.{1,64}/g) ?? [];
  return ["-----BEGIN PUBLIC KEY-----", ...linhas, "-----END PUBLIC KEY-----"].join("\n");
}

async function lerJson(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return {};
  }
}

function detalheDoErro(dados: unknown, status: number): string {
  const corpo = (dados ?? {}) as ErroPagBank;
  const primeiro = corpo.error_messages?.[0];
  if (primeiro?.description && primeiro.parameter_name) return `${primeiro.description} (${primeiro.parameter_name})`;
  return primeiro?.description ?? primeiro?.error ?? corpo.message ?? `HTTP ${status}`;
}
