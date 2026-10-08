/**
 * Tetos de upload e as duas conferências que fazem o teto valer antes de o
 * corpo ocupar memória. Módulo leve de propósito, pela mesma razão registrada
 * em `uploads-arquivos.ts`: rota que só precisa recusar um envio grande não
 * pode carregar `sharp` nem o removedor de fundo. Não importar `uploads.ts`,
 * `imagens.ts` nem `fundo.ts` daqui.
 */

/** Foto de produto, logo, banner e imagem de categoria enviados pelo painel. */
export const TETO_IMAGEM_BYTES = 5 * 1024 * 1024;

/** Imagem baixada de uma URL pública (`importarImagemDeUrl`). */
export const TETO_IMAGEM_URL_BYTES = 10 * 1024 * 1024;

/** Catálogo de 20 mil linhas em .xlsx dá poucos MB; acima disto é engano. */
export const TETO_PLANILHA_BYTES = 12 * 1024 * 1024;

/**
 * O `content-length` de um envio multipart conta o arquivo mais o envelope
 * (fronteiras, cabeçalho de cada parte, campos de texto como `sku`). Sem folga,
 * um arquivo exatamente no teto seria recusado. A regra exata continua sendo o
 * `arquivo.size` conferido depois; esta é só a barreira que evita ler o corpo.
 */
export const FOLGA_MULTIPART_BYTES = 64 * 1024;

export class UploadInvalido extends Error {}

/**
 * `true` quando o cabeçalho `content-length` declara um corpo maior que o teto
 * mais a folga do multipart. Serve para responder 413 antes de
 * `request.formData()`, que lê o corpo inteiro para a memória.
 *
 * Cabeçalho ausente ou inválido devolve `false`: envio em pedaços não é
 * recusado aqui (o teto de corpo, nesse caso, é do proxy).
 */
export function corpoAcimaDoTeto(request: { headers: Headers }, tetoBytes: number): boolean {
  const bruto = request.headers.get("content-length");
  if (bruto === null || !/^\d+$/.test(bruto.trim())) return false;
  return Number(bruto) > tetoBytes + FOLGA_MULTIPART_BYTES;
}

/**
 * Lê o corpo de uma resposta em fluxo e para assim que o acumulado passa do
 * teto. `resposta.arrayBuffer()` lê tudo antes de alguém poder conferir: uma
 * origem que não manda `content-length` entregaria o arquivo inteiro à memória.
 */
export async function lerComTeto(
  resposta: { body: ReadableStream<Uint8Array> | null },
  tetoBytes: number,
  mensagem = "Arquivo acima do tamanho permitido.",
): Promise<Buffer> {
  if (!resposta.body) return Buffer.alloc(0);
  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > tetoBytes) {
      await leitor.cancel().catch(() => {});
      throw new UploadInvalido(mensagem);
    }
    pedacos.push(value);
  }
  return Buffer.concat(pedacos, total);
}
