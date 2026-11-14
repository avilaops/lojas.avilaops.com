import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fiscalErpConfigurado } from "./erp-fiscal";
import { eventoCancelaNota, normalizarDocumentoEntrada } from "./fiscal-entrada-xml";
import type { EstadoRecebimentoFiscal } from "./fiscal-acompanhamento-estado";
import { resumirDocumentoFiscal } from "./fiscal-documento";

type Db = Pick<Prisma.TransactionClient, "tenant" | "documentoFiscalLoja" | "manifestacaoFiscalLoja" | "comandoEstoque">;
export type AcompanhamentoFiscal = {
  estado: EstadoRecebimentoFiscal;
  completoId: string | null;
  resumoId: string | null;
  cancelada: boolean;
  manifestacao: { status: string; tipo: string; codigo: string | null; motivo: string | null; protocolo: string | null } | null;
  recibo: { id: string; local: string; ator: string; confirmadoEm: string } | null;
};

function resumirRecibo(resultado: Prisma.JsonValue, chave: string): AcompanhamentoFiscal["recibo"] {
  if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) return null;
  if (resultado.tipo !== "ENTRADA_NFE" || resultado.chave !== chave) return null;
  const { id, local, ator, confirmadoEm } = resultado;
  if (typeof id !== "string" || typeof local !== "string" || typeof ator !== "string" || typeof confirmadoEm !== "string") return null;
  return { id, local, ator, confirmadoEm };
}

/** Projeção somente de leitura: a identidade operacional é tenant/chave, não o NSU. */
export async function consultarAcompanhamentoFiscal(tenantId: string, chaves: string[], db: Db = prisma): Promise<Map<string, AcompanhamentoFiscal>> {
  const unicas = [...new Set(chaves.filter(chave => /^\d{44}$/.test(chave)))];
  const mapa = new Map<string, AcompanhamentoFiscal>();
  if (!unicas.length) return mapa;
  const [tenant, documentos, conteudos, manifestacoes, comandos] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { cnpj: true } }),
    db.documentoFiscalLoja.findMany({ where: { tenantId, chave: { in: unicas } }, select: { id: true, chave: true, schema: true, cancelada: true }, orderBy: [{ recebidoEm: "desc" }, { id: "desc" }] }),
    db.documentoFiscalLoja.findMany({ where: { tenantId, chave: { in: unicas }, OR: [{ schema: { contains: "Evento", mode: "insensitive" } }, { schema: { startsWith: "resNFe" } }] }, select: { id: true, chave: true, schema: true, xml: true } }),
    db.manifestacaoFiscalLoja.findMany({ where: { tenantId, documento: { tenantId, chave: { in: unicas } } }, select: { status: true, tipo: true, codigoRetorno: true, motivoRetorno: true, protocolo: true, documento: { select: { chave: true } } }, orderBy: [{ intencaoEm: "desc" }, { id: "desc" }] }),
    db.comandoEstoque.findMany({ where: { tenantId, origem: "fiscal:entrada-nfe", chave: { in: unicas.map(chave => `nfe-entrada:${chave}`) } }, select: { chave: true, resultado: true } }),
  ]);
  const erp = fiscalErpConfigurado(normalizarDocumentoEntrada(tenant.cnpj ?? ""));
  for (const chave of unicas) {
    const notas = documentos.filter(d => d.chave === chave && /^(procNFe|resNFe)/i.test(d.schema));
    if (!notas.length) continue;
    const completoId = notas.find(d => /^procNFe/i.test(d.schema))?.id ?? null;
    const resumoId = notas.find(d => /^resNFe/i.test(d.schema))?.id ?? null;
    const resumo = conteudos.find(d => d.id === resumoId);
    const resumoFiscal = resumo ? resumirDocumentoFiscal(resumo.xml, resumo.schema, chave) : null;
    const codigoResumo = resumoFiscal?.manifestacaoCodigo ?? "";
    const cancelada = documentos.some(d => d.chave === chave && d.cancelada) || resumoFiscal?.situacaoNfe === "NF-e cancelada" || conteudos.some(e => {
      if (e.chave !== chave || !/evento/i.test(e.schema)) return false;
      try { return eventoCancelaNota(e.xml, chave); } catch { return false; }
    });
    const enviada = manifestacoes.find(m => m.documento.chave === chave);
    const manifestacao = enviada ? { status: enviada.status, tipo: enviada.tipo, codigo: enviada.codigoRetorno, motivo: enviada.motivoRetorno, protocolo: enviada.protocolo } : null;
    const comando = comandos.find(c => c.chave === `nfe-entrada:${chave}`);
    const recibo = comando ? resumirRecibo(comando.resultado, chave) : null;
    let estado: EstadoRecebimentoFiscal;
    if (cancelada) estado = recibo ? "REVISAO_NECESSARIA" : "CANCELADA";
    else if (recibo) estado = "ENTRADA_REGISTRADA";
    else if (erp) estado = "GERENCIADA_ERP";
    else if (completoId) estado = "PRONTA";
    else if (["2", "3"].includes(codigoResumo) || (manifestacao?.status === "ACEITA" && ["DESCONHECIMENTO", "NAO_REALIZADA"].includes(manifestacao.tipo))) estado = "REVISAO_NECESSARIA";
    else if (manifestacao?.status === "ACEITA" || ["1", "4"].includes(codigoResumo)) estado = "AGUARDANDO_XML";
    else if (manifestacao && manifestacao.status !== "REJEITADA") estado = "AGUARDANDO_RESULTADO";
    else estado = "AGUARDANDO_MANIFESTACAO";
    mapa.set(chave, { estado, completoId, resumoId, cancelada, manifestacao, recibo });
  }
  return mapa;
}
