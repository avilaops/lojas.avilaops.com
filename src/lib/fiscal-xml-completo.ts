import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ErroFiscal } from "./fiscal-certificado";

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: false });

/** Verifica destinatário, chave e autorização antes de associar XML ao resumo. */
export function validarXmlCompleto(xml: string, chave: string, cnpj: string) {
  if (Buffer.byteLength(xml) > 3 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ErroFiscal("XML completo inválido.");
  const raiz = parser.parse(xml);
  const info = raiz.nfeProc?.NFe?.infNFe;
  const protocolo = raiz.nfeProc?.protNFe?.infProt;
  if (!info || !protocolo || String(protocolo.cStat) !== "100") throw new ErroFiscal("Envie a NF-e completa autorizada (nfeProc), não apenas o resumo.");
  if (String(info["@_Id"]) !== `NFe${chave}` || String(protocolo.chNFe) !== chave) throw new ErroFiscal("A chave do XML não corresponde à nota selecionada.");
  if (String(info.dest?.CNPJ ?? "").replace(/\D/g, "") !== cnpj) throw new ErroFiscal("O destinatário da NF-e não corresponde ao CNPJ da loja.");
  if (String(info.ide?.mod) !== "55") throw new ErroFiscal("Somente NF-e modelo 55 é aceita.");
  return { chave, schema: "procNFe_v4.00.xsd", xml };
}
