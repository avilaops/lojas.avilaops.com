import { prisma } from "./db";
import { baixarFiscalErp } from "./erp-fiscal";
import { gerarDanfeCompartilhado } from "./fiscal-danfe-compartilhado";
import { type FormatoArquivoFiscal, lerRespostaArquivoFiscal, pdfFiscalValido, xmlNfeCompletoValido } from "./fiscal-conteudo";
import { guardarArquivoFiscal, lerArquivoFiscal } from "./fiscal-r2";

const SELECAO_DOCUMENTO = {
  id: true,
  cnpj: true,
  nsu: true,
  schema: true,
  chave: true,
  xml: true,
  arquivadoEm: true,
} as const;

export async function buscarDocumentoFiscalParaDownload(tenantId: string, id: string) {
  return prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId }, select: SELECAO_DOCUMENTO });
}

type DocumentoFiscal = NonNullable<Awaited<ReturnType<typeof buscarDocumentoFiscalParaDownload>>>;
type DependenciasLocais = {
  buscarDocumento: typeof buscarDocumentoFiscalParaDownload;
  lerArquivo: typeof lerArquivoFiscal;
  guardarArquivo: typeof guardarArquivoFiscal;
  gerarDanfe: typeof gerarDanfeCompartilhado;
};
type DependenciasErp = { baixarArquivo: typeof baixarFiscalErp };

const DEPENDENCIAS_LOCAIS: DependenciasLocais = {
  buscarDocumento: buscarDocumentoFiscalParaDownload,
  lerArquivo: lerArquivoFiscal,
  guardarArquivo: guardarArquivoFiscal,
  gerarDanfe: gerarDanfeCompartilhado,
};
const DEPENDENCIAS_ERP: DependenciasErp = { baixarArquivo: baixarFiscalErp };

function respostaDeErro(erro: string, status: number) {
  return Response.json({ erro }, { status, headers: { "Cache-Control": "private, no-store" } });
}

function identificadorSeguro(documento: DocumentoFiscal): string {
  if (/^\d{44}$/.test(documento.chave ?? "")) return documento.chave!;
  if (/^\d{15}$/.test(documento.nsu)) return documento.nsu;
  return documento.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "documento";
}

function cabecalhos(formato: FormatoArquivoFiscal, nome: string) {
  return {
    "Content-Type": formato === "xml" ? "application/xml; charset=utf-8" : "application/pdf",
    "Content-Disposition": `attachment; filename="${nome}.${formato}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function corpoResposta(conteudo: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(conteudo.byteLength);
  copia.set(conteudo);
  return copia.buffer;
}

function documentoCompleto(documento: DocumentoFiscal): boolean {
  return /^procNFe/i.test(documento.schema) && xmlNfeCompletoValido(documento.xml);
}

export async function responderDownloadXmlFiscal(
  tenantId: string,
  id: string,
  deps: DependenciasLocais = DEPENDENCIAS_LOCAIS,
): Promise<Response> {
  const documento = await deps.buscarDocumento(tenantId, id);
  if (!documento) return respostaDeErro("Documento não encontrado.", 404);
  if (!documentoCompleto(documento)) {
    return respostaDeErro("XML completo ainda não disponível para esta NF-e.", 409);
  }

  let conteudo: Uint8Array<ArrayBufferLike> = new TextEncoder().encode(documento.xml);
  if (documento.arquivadoEm && /^\d{14}$/.test(documento.cnpj) && /^\d{44}$/.test(documento.chave ?? "")) {
    try {
      const arquivado = await deps.lerArquivo(documento.cnpj, documento.chave!, "xml");
      if (arquivado && xmlNfeCompletoValido(arquivado)) conteudo = arquivado;
    } catch {
      console.error("[fiscal] cache XML indisponível; usando banco");
    }
  }
  return new Response(corpoResposta(conteudo), { headers: cabecalhos("xml", `NFe-${identificadorSeguro(documento)}`) });
}

export async function responderDownloadDanfeFiscal(
  tenantId: string,
  id: string,
  deps: DependenciasLocais = DEPENDENCIAS_LOCAIS,
): Promise<Response> {
  const documento = await deps.buscarDocumento(tenantId, id);
  if (!documento) return respostaDeErro("Documento não encontrado.", 404);
  if (!documentoCompleto(documento)) {
    return respostaDeErro("Apenas resumo fiscal disponível; XML completo necessário para gerar DANFE.", 409);
  }

  try {
    let arquivo: Uint8Array | null = null;
    const identificacaoValida = /^\d{14}$/.test(documento.cnpj) && /^\d{44}$/.test(documento.chave ?? "");
    if (identificacaoValida) {
      try {
        const armazenado = await deps.lerArquivo(documento.cnpj, documento.chave!, "pdf");
        if (armazenado && pdfFiscalValido(armazenado)) arquivo = armazenado;
      } catch {
        console.error("[fiscal] leitura do cache PDF indisponível");
      }
    }
    if (!arquivo) {
      arquivo = await deps.gerarDanfe(documento.xml);
      if (!arquivo) return respostaDeErro("Serviço compartilhado de DANFE não configurado.", 503);
      if (!pdfFiscalValido(arquivo)) throw new Error("PDF inválido.");
      if (identificacaoValida) {
        try {
          await deps.guardarArquivo(documento.cnpj, documento.chave!, "pdf", arquivo);
        } catch {
          console.error("[fiscal] cache PDF indisponível; download mantido");
        }
      }
    }
    return new Response(corpoResposta(arquivo), { headers: cabecalhos("pdf", `DANFE-${identificadorSeguro(documento)}`) });
  } catch {
    return respostaDeErro("Falha ao gerar DANFE no serviço fiscal compartilhado.", 502);
  }
}

export async function responderDownloadFiscalErp(
  cnpj: string,
  id: string,
  formato: string,
  deps: DependenciasErp = DEPENDENCIAS_ERP,
): Promise<Response> {
  if (formato !== "xml" && formato !== "danfe") return respostaDeErro("Arquivo fiscal inválido.", 404);
  let upstream: Response | null;
  try {
    upstream = await deps.baixarArquivo(cnpj, id, formato);
  } catch {
    return respostaDeErro("O ERP fiscal está temporariamente indisponível.", 502);
  }
  if (!upstream) return respostaDeErro("Integração fiscal com o ERP não configurada.", 404);
  if (!upstream.ok || !upstream.body) {
    return respostaDeErro("O ERP não entregou o arquivo fiscal.", upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
  }
  try {
    const formatoArquivo = formato === "xml" ? "xml" : "pdf";
    const arquivo = await lerRespostaArquivoFiscal(upstream, formatoArquivo);
    return new Response(corpoResposta(arquivo), { headers: cabecalhos(formatoArquivo, `NFe-${id}`) });
  } catch {
    return respostaDeErro("O ERP devolveu um arquivo fiscal inválido.", 502);
  }
}
