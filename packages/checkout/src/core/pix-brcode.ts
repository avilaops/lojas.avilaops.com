/**
 * BR Code estático do Pix, no formato EMV do Manual de Padrões para Iniciação
 * do Pix (Banco Central).
 *
 * A chave vai no payload (campo 26, GUI `br.gov.bcb.pix`). Não há URL de
 * cobrança dinâmica e não entra dado de quem paga: só chave, nome de quem
 * recebe, cidade, valor e o txid.
 *
 * O CRC16 é o CRC-16/CCITT-FALSE: polinômio 0x1021, valor inicial 0xFFFF, sem
 * reflexão e sem XOR final. Calcula-se sobre o payload já com o prefixo
 * `6304` do campo de CRC, e o resultado entra em quatro hex maiúsculos.
 */

const encoder = new TextEncoder();

/** Até quantos centavos a mais o valor pode subir para continuar único. */
export const FOLGA_CENTAVOS_UNICOS = 99;

/** CRC16 do Manual, sobre o texto UTF-8 (no exemplo oficial, só ASCII). */
export function crc16Pix(dados: string): string {
  const bytes = encoder.encode(dados);
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      const bitAlto = (crc & 0x8000) !== 0;
      crc = (crc << 1) & 0xffff;
      if (bitAlto) crc ^= 0x1021;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, valor: string): string {
  const tamanho = encoder.encode(valor).length;
  if (tamanho < 1 || tamanho > 99) {
    throw new Error(`Campo ${id} do Pix fora do tamanho permitido.`);
  }
  return `${id}${String(tamanho).padStart(2, "0")}${valor}`;
}

/** Reais com ponto e duas casas, como o campo 54 do BR Code pede. */
export function valorPixEmReais(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos <= 0) {
    throw new Error("Valor do Pix inválido.");
  }
  const texto = `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
  if (texto.length > 13) throw new Error("Valor do Pix acima do que o BR Code carrega.");
  return texto;
}

/**
 * txid do QR estático: 1 a 25 caracteres, só letras e números.
 *
 * A referência do pedido entra inteira quando já cabe. Se tiver hífen ou
 * passar de 25, ficam os últimos 25 alfanuméricos — a parte aleatória da
 * referência fica no fim, então o corte não junta dois pedidos.
 */
export function txidDaReferencia(referencia: string): string {
  const limpo = referencia.replace(/[^A-Za-z0-9]/g, "");
  if (limpo.length < 1) {
    throw new Error("A referência do pedido não serve como identificador do Pix.");
  }
  return limpo.length <= 25 ? limpo : limpo.slice(-25);
}

export interface DadosBrCode {
  /** Chave já normalizada por `validarChavePix`. */
  chave: string;
  nome: string;
  cidade: string;
  /** Omitido, o QR não traz valor (o manual permite; aqui a cobrança sempre traz). */
  valorCentavos?: number;
  /** Omitido, o campo vai `***`, que é o txid vazio do QR estático. */
  txid?: string;
}

/** Copia-e-cola completo, com CRC. */
export function montarBrCodePix(dados: DadosBrCode): string {
  const txid = dados.txid ?? "***";
  if (txid !== "***" && !/^[A-Za-z0-9]{1,25}$/.test(txid)) {
    throw new Error("Identificador do Pix inválido.");
  }
  const conta = tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", dados.chave));
  let corpo = tlv("00", "01") + conta + tlv("52", "0000") + tlv("53", "986");
  if (dados.valorCentavos != null) corpo += tlv("54", valorPixEmReais(dados.valorCentavos));
  corpo += tlv("58", "BR") + tlv("59", dados.nome) + tlv("60", dados.cidade);
  corpo += tlv("62", tlv("05", txid));
  const semCrc = `${corpo}6304`;
  return semCrc + crc16Pix(semCrc);
}

/**
 * Valor que a pessoa paga.
 *
 * Dois Pix do mesmo valor na mesma chave ficam iguais no extrato. Sobe de um
 * em um centavo, no máximo `FOLGA_CENTAVOS_UNICOS`, até achar um que nenhuma
 * cobrança em aberto desta loja esteja usando. O total do pedido não muda:
 * a diferença só identifica o pagamento.
 */
export function valorComCentavosUnicos(totalCentavos: number, ocupados: readonly number[]): number {
  if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) {
    throw new Error("Valor do Pix inválido.");
  }
  const usados = new Set(ocupados);
  for (let extra = 0; extra <= FOLGA_CENTAVOS_UNICOS; extra++) {
    const candidato = totalCentavos + extra;
    if (!usados.has(candidato)) return candidato;
  }
  throw new Error("Não há centavo livre para identificar este Pix agora. Tente de novo em alguns minutos.");
}
