import { XMLParser, XMLValidator } from "fast-xml-parser";

export type ResumoDocumentoFiscal = {
  fornecedor: string | null;
  numero: string | null;
  valorCentavos: number | null;
  emitidaEm: string | null;
  situacao: "COMPLETA" | "RESUMO" | "OUTRO";
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

export function resumirDocumentoFiscal(xml: string, schema: string, chave: string | null): ResumoDocumentoFiscal {
  const vazio: ResumoDocumentoFiscal = { fornecedor: null, numero: numeroPelaChave(chave), valorCentavos: null, emitidaEm: null, situacao: "OUTRO" };
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return vazio;

  try {
    const lido = parser.parse(xml);
    if (/^resNFe/i.test(schema)) {
      const nota = lido.resNFe ?? lido;
      return {
        fornecedor: texto(nota.xNome) || null,
        numero: numeroPelaChave(texto(nota.chNFe) || chave),
        valorCentavos: centavos(nota.vNF),
        emitidaEm: texto(nota.dhEmi) || null,
        situacao: "RESUMO",
      };
    }
    if (/^procNFe/i.test(schema)) {
      const info = lido.nfeProc?.NFe?.infNFe ?? lido.NFe?.infNFe;
      if (!info) return vazio;
      return {
        fornecedor: texto(info.emit?.xNome) || null,
        numero: texto(info.ide?.nNF) || numeroPelaChave(chave),
        valorCentavos: centavos(info.total?.ICMSTot?.vNF),
        emitidaEm: texto(info.ide?.dhEmi ?? info.ide?.dEmi) || null,
        situacao: "COMPLETA",
      };
    }
  } catch {}
  return vazio;
}
