import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { resumirDocumentoFiscal } from "./fiscal-documento";

export const EVENTOS_FISCAIS = {
  "fiscal.nfe-resumo": "Resumo de NF-e recebido",
  "fiscal.nfe-recebida": "XML completo de NF-e recebido",
  "fiscal.evento-recebido": "Evento fiscal recebido",
} as const;
export const FINALIDADES_FISCAIS = {
  fornecedores: "Conferência de fornecedores",
  compras: "Conciliação de compras",
  produtos: "Revisão de produtos",
  divergencias: "Tratamento de divergências",
} as const;
export const CAMPOS_FISCAIS = {
  fornecedor: "Identificação do fornecedor",
  totais: "Valores e emissão",
  itens: "Produtos, quantidades e valores",
  evento: "Tipo e protocolo do evento fiscal",
} as const;
export type EventoFiscal = keyof typeof EVENTOS_FISCAIS;

export const ConfigurarFluxoFiscal = z.object({
  nome: z.string().trim().min(2).max(60),
  webhookId: z.string().min(1).max(80),
  finalidade: z.enum(["fornecedores", "compras", "produtos", "divergencias"]),
  eventos: z.array(z.enum(["fiscal.nfe-resumo", "fiscal.nfe-recebida", "fiscal.evento-recebido"])).min(1).max(3).transform((v) => [...new Set(v)]),
  campos: z.array(z.enum(["fornecedor", "totais", "itens", "evento"])).min(1).max(4).transform((v) => [...new Set(v)]),
}).strict().refine((v) => v.finalidade !== "produtos" || v.eventos.every((e) => e === "fiscal.nfe-recebida"), {
  message: "A revisão de produtos exige XML completo de NF-e.", path: ["eventos"],
});

type Documento = { id: string; cnpj: string; nsu: string; schema: string; chave: string | null; xml: string; recebidoEm: Date };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const texto = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : null;
function valorCentavos(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d+(\.\d{1,10})?$/.test(v)) return null;
  const n = Math.round(Number(v) * 100);
  return Number.isSafeInteger(n) ? n : null;
}

/** Projeção fechada: nunca envia XML bruto, certificado, credencial ou campos não selecionados. */
export function dadosParaFluxoFiscal(doc: Documento, campos: readonly string[]) {
  if (doc.xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(doc.xml) || XMLValidator.validate(doc.xml) !== true) return null;
  const lido = objeto(new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: false }).parse(doc.xml));
  const resumo = resumirDocumentoFiscal(doc.xml, doc.schema, doc.chave);
  const tipo: EventoFiscal | null = /^resNFe/i.test(doc.schema) && lido.resNFe ? "fiscal.nfe-resumo"
    : /^procNFe/i.test(doc.schema) && resumo.situacao === "COMPLETA" ? "fiscal.nfe-recebida"
    : /evento/i.test(doc.schema) && (lido.procEventoNFe || lido.resEvento || lido.evento) ? "fiscal.evento-recebido" : null;
  if (!tipo) return null;
  const info = objeto(objeto(objeto(lido.nfeProc).NFe ?? lido.NFe).infNFe);
  const emitente = tipo === "fiscal.nfe-resumo" ? objeto(lido.resNFe) : objeto(info.emit);
  const proc = objeto(lido.procEventoNFe);
  const evento = objeto(objeto(proc.evento ?? lido.evento).infEvento ?? lido.resEvento);
  const retorno = objeto(objeto(proc.retEvento).infEvento);
  const det = Array.isArray(info.det) ? info.det : info.det ? [info.det] : [];
  const dados = {
    documento: { id: doc.id, cnpj: doc.cnpj, nsu: doc.nsu, schema: doc.schema, chave: doc.chave, numero: resumo.numero, situacao: resumo.situacao, recebidoEm: doc.recebidoEm.toISOString() },
    ...(campos.includes("fornecedor") ? { fornecedor: { nome: resumo.fornecedor, documento: texto(emitente.CNPJ ?? emitente.CPF), inscricaoEstadual: texto(emitente.IE) } } : {}),
    ...(campos.includes("totais") ? { totais: { valorCentavos: valorCentavos(tipo === "fiscal.nfe-resumo" ? objeto(lido.resNFe).vNF : objeto(objeto(info.total).ICMSTot).vNF), emitidaEm: resumo.emitidaEm } } : {}),
    ...(campos.includes("itens") ? { itensDisponiveis: tipo === "fiscal.nfe-recebida", itens: det.map((d: unknown) => {
      const p = objeto(objeto(d).prod);
      return { codigo: texto(p.cProd), descricao: texto(p.xProd), gtin: texto(p.cEAN), ncm: texto(p.NCM), cfop: texto(p.CFOP), unidade: texto(p.uCom), quantidade: texto(p.qCom), valorUnitario: texto(p.vUnCom), totalCentavos: valorCentavos(p.vProd) };
    }) } : {}),
    ...(campos.includes("evento") ? { evento: { tipo: texto(evento.tpEvento), sequencia: texto(evento.nSeqEvento), ocorridoEm: texto(evento.dhEvento), protocolo: texto(retorno.nProt ?? evento.nProt), descricao: texto(objeto(evento.detEvento).descEvento ?? evento.xEvento) } } : {}),
  };
  return { tipo, dados };
}
