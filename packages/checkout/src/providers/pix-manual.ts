import { montarBrCodePix, txidDaReferencia } from "../core/pix-brcode.ts";
import type { PedidoCheckout, ResultadoPagamento } from "../core/types.ts";
import { CobrancaRecusada } from "./erros.ts";
import type { EstadoPixManual, PaymentProvider, WebhookEntrada } from "./types.ts";

const MENSAGEM_SEM_ESTORNO = "Este Pix não tem estorno automático. Devolva o valor pela conta do banco e registre no pedido.";
const MENSAGEM_SO_PIX = "Este recebimento só aceita Pix.";

export interface PixManualConfig {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  expiraEmMinutos: number;
  porta: EstadoPixManual;
  gerarQr?: (copiaECola: string) => Promise<string | undefined>;
}

/**
 * Pix direto na chave do lojista.
 *
 * Não fala com banco nenhum. Gera o BR Code estático, guarda a cobrança pela
 * porta da loja e fica em `aguardando_confirmacao` até alguém confirmar na
 * mão. Webhook não existe: qualquer aviso de "pagou" é ignorado.
 */
export class PixManualProvider implements PaymentProvider {
  readonly nome = "Pix na conta";
  private readonly chave: string;
  private readonly nomeRecebedor: string;
  private readonly cidade: string;
  private readonly expiraEmMinutos: number;
  private readonly porta: EstadoPixManual;
  private readonly gerarQr?: (copiaECola: string) => Promise<string | undefined>;

  constructor(config: PixManualConfig) {
    this.chave = config.chave;
    this.nomeRecebedor = config.nomeRecebedor;
    this.cidade = config.cidade;
    this.expiraEmMinutos = config.expiraEmMinutos;
    this.porta = config.porta;
    this.gerarQr = config.gerarQr;
  }

  async cobrar(pedido: PedidoCheckout, totalEmCentavos: number): Promise<ResultadoPagamento> {
    if (pedido.meioPagamento !== "pix") {
      throw new CobrancaRecusada(MENSAGEM_SO_PIX, 422);
    }
    let txid: string;
    try {
      txid = txidDaReferencia(pedido.referencia);
    } catch (erro) {
      throw new CobrancaRecusada(erro instanceof Error ? erro.message : MENSAGEM_SO_PIX, 422);
    }
    const expiraEm = new Date(Date.now() + this.expiraEmMinutos * 60_000);
    let reservado: Awaited<ReturnType<EstadoPixManual["reservar"]>>;
    try {
      reservado = await this.porta.reservar({
        referencia: pedido.referencia,
        totalCentavos: totalEmCentavos,
        txid,
        expiraEm,
        montar: (valorCentavos) => montarBrCodePix({
          chave: this.chave,
          nome: this.nomeRecebedor,
          cidade: this.cidade,
          valorCentavos,
          txid,
        }),
      });
    } catch (erro) {
      if (erro instanceof CobrancaRecusada) throw erro;
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível gerar o Pix.";
      throw new CobrancaRecusada(mensagem, 422);
    }
    const atual = await this.porta.consultar(reservado.id);
    return this.comQr(atual ?? {
      id: reservado.id,
      status: "aguardando_confirmacao",
      meioPagamento: "pix",
      valor: reservado.valorCentavos,
      pix: { copiaECola: reservado.copiaECola, expiraEm: expiraEm.toISOString() },
    });
  }

  async consultar(pagamentoId: string): Promise<ResultadoPagamento> {
    const achado = await this.porta.consultar(pagamentoId);
    if (!achado) throw new Error("Pagamento não encontrado.");
    return this.comQr(achado);
  }

  async buscarPorReferencia(referencia: string): Promise<ResultadoPagamento | null> {
    const achado = await this.porta.buscarPorReferencia(referencia);
    return achado ? this.comQr(achado) : null;
  }

  async estornar(
    pagamentoId: string,
    opcoes?: { valorEmCentavos?: number; motivo?: string },
  ): Promise<ResultadoPagamento> {
    void pagamentoId;
    void opcoes;
    throw new CobrancaRecusada(MENSAGEM_SEM_ESTORNO, 422);
  }

  /** Não há webhook. Assinatura nenhuma confirma este Pix. */
  async validarWebhook(entrada: WebhookEntrada): Promise<null> {
    void entrada;
    return null;
  }

  private async comQr(resultado: ResultadoPagamento): Promise<ResultadoPagamento> {
    const gerar = this.gerarQr ?? this.porta.qr?.bind(this.porta);
    if (!resultado.pix || resultado.pix.qrCodeBase64 || !gerar) return resultado;
    const qr = await gerar(resultado.pix.copiaECola).catch(() => undefined);
    if (!qr) return resultado;
    return { ...resultado, pix: { ...resultado.pix, qrCodeBase64: qr } };
  }
}
