import { XMLParser, XMLValidator } from "fast-xml-parser";

export type ResumoDocumentoFiscal = {
  tipo: "NFE" | "EVENTO" | "OUTRO";
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
    if (/evento/i.test(schema)) {
      const resumo = lido.resEvento;
      const evento = lido.procEventoNFe?.evento?.infEvento ?? lido.evento?.infEvento;
      const retorno = lido.procEventoNFe?.retEvento?.infEvento ?? lido.retEvento?.infEvento;
      const info = resumo ?? evento ?? retorno;
      if (!info) return fallback;
      const descricao = primeiro(resumo?.xEvento, evento?.detEvento?.descEvento, retorno?.xEvento);
      const eventoChave = primeiro(info.chNFe, retorno?.chNFe, chave);
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
