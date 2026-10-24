import { XMLParser, XMLValidator } from "fast-xml-parser";

export type ResumoDocumentoFiscal = {
  tipo: "NFE" | "CTE" | "EVENTO" | "OUTRO";
  fornecedor: string | null;
  documentoFornecedor: string | null;
  inscricaoEstadual: string | null;
  numero: string | null;
  valorCentavos: number | null;
  emitidaEm: string | null;
  autorizadaEm: string | null;
  protocolo: string | null;
  operacao: string | null;
  situacaoNfe: string | null;
  manifestacao: string | null;
  quantidadeItens: number | null;
  eventoCodigo: string | null;
  eventoDescricao: string | null;
  eventoSequencia: number | null;
  eventoRegistradoEm: string | null;
  eventoStatus: string | null;
  eventoMotivo: string | null;
  situacao: "COMPLETA" | "RESUMO" | "EVENTO" | "OUTRO";
};

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: false });
const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();

function centavos(valor: unknown): number | null {
  const numero = Number(texto(valor).replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}

function numeroPelaChave(chave: string | null): string | null {
  return chave && /^\d{44}$/.test(chave) ? String(Number(chave.slice(25, 34))) : null;
}

function primeiro(...valores: unknown[]): string | null {
  for (const valor of valores) {
    const resultado = texto(valor);
    if (resultado) return resultado;
  }
  return null;
}

function inteiro(valor: unknown): number | null {
  const numero = Number(texto(valor));
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

function quantidadeItens(valor: unknown): number | null {
  if (Array.isArray(valor)) return valor.length;
  return valor && typeof valor === "object" ? 1 : null;
}

function tipoOperacao(codigo: unknown): string | null {
  const valor = texto(codigo);
  return valor === "0" ? "Entrada" : valor === "1" ? "Saída" : null;
}

function situacaoNfe(codigo: unknown): string | null {
  return ({ "1": "Uso autorizado", "2": "Uso denegado", "3": "NF-e cancelada" } as Record<string, string>)[texto(codigo)] ?? null;
}

function situacaoCte(codigo: unknown): string | null {
  return ({ "1": "Uso autorizado", "2": "Uso denegado", "3": "CT-e cancelado" } as Record<string, string>)[texto(codigo)] ?? null;
}

function situacaoManifestacao(codigo: unknown): string | null {
  return ({
    "0": "Sem manifestação",
    "1": "Operação confirmada",
    "2": "Operação desconhecida",
    "3": "Operação não realizada",
    "4": "Ciência da operação",
  } as Record<string, string>)[texto(codigo)] ?? null;
}

function vazio(chave: string | null): ResumoDocumentoFiscal {
  return {
    tipo: "OUTRO",
    fornecedor: null,
    documentoFornecedor: null,
    inscricaoEstadual: null,
    numero: numeroPelaChave(chave),
    valorCentavos: null,
    emitidaEm: null,
    autorizadaEm: null,
    protocolo: null,
    operacao: null,
    situacaoNfe: null,
    manifestacao: null,
    quantidadeItens: null,
    eventoCodigo: null,
    eventoDescricao: null,
    eventoSequencia: null,
    eventoRegistradoEm: null,
    eventoStatus: null,
    eventoMotivo: null,
    situacao: "OUTRO",
  };
}

export function resumirDocumentoFiscal(xml: string, schema: string, chave: string | null): ResumoDocumentoFiscal {
  const fallback = vazio(chave);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return fallback;

  try {
    const lido = parser.parse(xml);
    if (/^resNFe/i.test(schema)) {
      const nota = lido.resNFe ?? lido;
      return {
        ...fallback,
        tipo: "NFE",
        fornecedor: texto(nota.xNome) || null,
        documentoFornecedor: primeiro(nota.CNPJ, nota.CPF),
        inscricaoEstadual: texto(nota.IE) || null,
        numero: numeroPelaChave(texto(nota.chNFe) || chave),
        valorCentavos: centavos(nota.vNF),
        emitidaEm: texto(nota.dhEmi) || null,
        autorizadaEm: texto(nota.dhRecbto) || null,
        protocolo: texto(nota.nProt) || null,
        operacao: tipoOperacao(nota.tpNF),
        situacaoNfe: situacaoNfe(nota.cSitNFe),
        manifestacao: situacaoManifestacao(nota.cSitConf),
        situacao: "RESUMO",
      };
    }
    if (/^procNFe/i.test(schema)) {
      const info = lido.nfeProc?.NFe?.infNFe ?? lido.NFe?.infNFe;
      const protocolo = lido.nfeProc?.protNFe?.infProt ?? lido.protNFe?.infProt;
      if (!info) return fallback;
      return {
        ...fallback,
        tipo: "NFE",
        fornecedor: texto(info.emit?.xNome) || null,
        documentoFornecedor: primeiro(info.emit?.CNPJ, info.emit?.CPF),
        inscricaoEstadual: texto(info.emit?.IE) || null,
        numero: texto(info.ide?.nNF) || numeroPelaChave(chave),
        valorCentavos: centavos(info.total?.ICMSTot?.vNF),
        emitidaEm: texto(info.ide?.dhEmi ?? info.ide?.dEmi) || null,
        autorizadaEm: texto(protocolo?.dhRecbto) || null,
        protocolo: texto(protocolo?.nProt) || null,
        operacao: tipoOperacao(info.ide?.tpNF),
        situacaoNfe: situacaoNfe(protocolo?.cStat === "100" ? "1" : null),
        quantidadeItens: quantidadeItens(info.det),
        situacao: "COMPLETA",
      };
    }
    if (/^resCTe/i.test(schema)) {
      const cte = lido.resCTe ?? lido;
      const chaveCte = primeiro(cte.chCTe, chave);
      return {
        ...fallback,
        tipo: "CTE",
        fornecedor: texto(cte.xNome) || null,
        documentoFornecedor: primeiro(cte.CNPJ, cte.CPF),
        inscricaoEstadual: texto(cte.IE) || null,
        numero: numeroPelaChave(chaveCte),
        valorCentavos: centavos(cte.vTPrest),
        emitidaEm: primeiro(cte.dhEmi, cte.dEmi),
        autorizadaEm: texto(cte.dhRecbto) || null,
        protocolo: texto(cte.nProt) || null,
        situacaoNfe: situacaoCte(cte.cSitCTe),
        situacao: "RESUMO",
      };
    }
    if (/^(procCTe|cteProc)/i.test(schema)) {
      const info = lido.cteProc?.CTe?.infCte ?? lido.CTe?.infCte;
      const protocolo = lido.cteProc?.protCTe?.infProt ?? lido.protCTe?.infProt;
      if (!info) return fallback;
      return {
        ...fallback,
        tipo: "CTE",
        fornecedor: texto(info.emit?.xNome) || null,
        documentoFornecedor: primeiro(info.emit?.CNPJ, info.emit?.CPF),
        inscricaoEstadual: texto(info.emit?.IE) || null,
        numero: primeiro(info.ide?.nCT, numeroPelaChave(chave)),
        valorCentavos: centavos(info.vPrest?.vTPrest),
        emitidaEm: primeiro(info.ide?.dhEmi, info.ide?.dEmi),
        autorizadaEm: texto(protocolo?.dhRecbto) || null,
        protocolo: texto(protocolo?.nProt) || null,
        operacao: texto(info.ide?.natOp) || null,
        situacaoNfe: situacaoCte(protocolo?.cStat === "100" ? "1" : null),
        quantidadeItens: quantidadeItens(info.infCTeNorm?.infDoc?.infNFe),
        situacao: "COMPLETA",
      };
    }
    if (/evento/i.test(schema)) {
      const resumo = lido.resEvento;
      const evento = lido.procEventoNFe?.evento?.infEvento ?? lido.procEventoCTe?.eventoCTe?.infEvento ?? lido.evento?.infEvento ?? lido.eventoCTe?.infEvento;
      const retorno = lido.procEventoNFe?.retEvento?.infEvento ?? lido.procEventoCTe?.retEventoCTe?.infEvento ?? lido.retEvento?.infEvento ?? lido.retEventoCTe?.infEvento;
      const info = resumo ?? evento ?? retorno;
      if (!info) return fallback;
      const descricao = primeiro(resumo?.xEvento, evento?.detEvento?.descEvento, retorno?.xEvento);
      const eventoChave = primeiro(info.chNFe, info.chCTe, retorno?.chNFe, retorno?.chCTe, chave);
      return {
        ...fallback,
        tipo: "EVENTO",
        documentoFornecedor: primeiro(info.CNPJ, info.CPF, retorno?.CNPJDest, retorno?.CPFDest),
        numero: numeroPelaChave(eventoChave),
        protocolo: primeiro(resumo?.nProt, retorno?.nProt),
        eventoCodigo: primeiro(info.tpEvento, retorno?.tpEvento),
        eventoDescricao: descricao,
        eventoSequencia: inteiro(primeiro(info.nSeqEvento, retorno?.nSeqEvento)),
        eventoRegistradoEm: primeiro(resumo?.dhRecbto, retorno?.dhRegEvento, info.dhEvento),
        eventoStatus: primeiro(retorno?.cStat),
        eventoMotivo: primeiro(retorno?.xMotivo),
        situacao: "EVENTO",
      };
    }
  } catch {}
  return fallback;
}

const dataValida = (valor: string | null): Date | null => {
  if (!valor) return null;
  const resultado = new Date(valor);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
};

/** Campos de busca derivados. O XML original continua sendo a única fonte para reprocessamento. */
export function cabecalhoDocumentoFiscal(xml: string, schema: string, chave: string | null) {
  const resumo = resumirDocumentoFiscal(xml, schema, chave);
  const versao = schema.match(/_v([0-9.]+)/i)?.[1] ?? null;
  const evento = /evento/i.test(schema);
  const completo = resumo.situacao === "COMPLETA";
  const tipoDocumento = resumo.tipo === "NFE" ? "NFE" : resumo.tipo === "CTE" ? "CTE" : evento ? (/cte/i.test(schema) ? "CTE_EVENTO" : "NFE_EVENTO") : "DESCONHECIDO";
  return {
    tipoDocumento,
    modelo: resumo.tipo === "NFE" ? "55" : resumo.tipo === "CTE" ? "57" : null,
    versaoSchema: versao,
    estadoConteudo: completo ? "COMPLETO" : resumo.situacao === "RESUMO" ? "RESUMO" : evento ? "EVENTO" : "INVALIDO_OU_DESCONHECIDO",
    validacao: resumo.situacao === "OUTRO" ? "INVALIDO_OU_NAO_SUPORTADO" : "ESTRUTURA_INTERPRETADA",
    errosInterpretacao: resumo.situacao === "OUTRO" ? ["XML malformado, inseguro ou schema não suportado pelo parser local."] : [],
    dadosIncompletos: !completo,
    categoria: resumo.situacao === "RESUMO" ? `${tipoDocumento}_RESUMO` : resumo.situacao === "COMPLETA" ? `${tipoDocumento}_COMPLETO` : evento ? `${tipoDocumento}_EVENTO` : "DESCONHECIDO",
    numero: resumo.numero,
    emitidaEm: dataValida(resumo.emitidaEm),
    autorizadaEm: dataValida(resumo.autorizadaEm),
    statusFiscal: resumo.situacaoNfe,
    protocolo: resumo.protocolo,
    cancelada: /cancelad/i.test(resumo.situacaoNfe ?? "") || resumo.eventoCodigo === "110111",
    emitenteDocumento: resumo.documentoFornecedor,
    emitenteNome: resumo.fornecedor,
  };
}
