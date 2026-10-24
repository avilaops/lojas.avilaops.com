const LIMITE_ARQUIVO_FISCAL = 12 * 1024 * 1024;

export type FormatoArquivoFiscal = "xml" | "pdf";

export class ErroConteudoFiscal extends Error {}

function texto(conteudo: string | Uint8Array): string {
  return typeof conteudo === "string" ? conteudo : new TextDecoder().decode(conteudo);
}

export function xmlNfeCompletoValido(conteudo: string | Uint8Array): boolean {
  const bytes = typeof conteudo === "string" ? new TextEncoder().encode(conteudo) : conteudo;
  if (!bytes.byteLength || bytes.byteLength > LIMITE_ARQUIVO_FISCAL) return false;
  const xml = texto(conteudo);
  return !/<!DOCTYPE|<!ENTITY/i.test(xml)
    && /<(?:(?:\w+):)?nfeProc\b/i.test(xml)
    && /<(?:(?:\w+):)?NFe\b/i.test(xml)
    && /<(?:(?:\w+):)?infNFe\b/i.test(xml)
    && /<(?:(?:\w+):)?protNFe\b[\s\S]*?<(?:(?:\w+):)?infProt\b[\s\S]*?<(?:(?:\w+):)?cStat\b[^>]*>\s*100\s*</i.test(xml);
}

export function pdfFiscalValido(conteudo: Uint8Array): boolean {
  return conteudo.byteLength > 5
    && conteudo.byteLength <= LIMITE_ARQUIVO_FISCAL
    && new TextDecoder().decode(conteudo.slice(0, 5)) === "%PDF-";
}

async function lerComLimite(resposta: Response): Promise<Uint8Array> {
  const tamanhoDeclarado = Number(resposta.headers.get("content-length"));
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > LIMITE_ARQUIVO_FISCAL) {
    throw new ErroConteudoFiscal("Arquivo fiscal excede o limite.");
  }
  if (!resposta.body) throw new ErroConteudoFiscal("Arquivo fiscal vazio.");

  const reader = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_ARQUIVO_FISCAL) {
      await reader.cancel();
      throw new ErroConteudoFiscal("Arquivo fiscal excede o limite.");
    }
    partes.push(value);
  }
  if (!total) throw new ErroConteudoFiscal("Arquivo fiscal vazio.");

  const conteudo = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    conteudo.set(parte, posicao);
    posicao += parte.byteLength;
  }
  return conteudo;
}

export async function lerRespostaArquivoFiscal(resposta: Response, formato: FormatoArquivoFiscal): Promise<Uint8Array> {
  const tipo = resposta.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (formato === "pdf" ? tipo !== "application/pdf" : tipo !== "application/xml" && tipo !== "text/xml") {
    throw new ErroConteudoFiscal("Tipo do arquivo fiscal inválido.");
  }
  const conteudo = await lerComLimite(resposta);
  if (formato === "pdf" ? !pdfFiscalValido(conteudo) : !xmlNfeCompletoValido(conteudo)) {
    throw new ErroConteudoFiscal("Conteúdo do arquivo fiscal inválido.");
  }
  return conteudo;
}
