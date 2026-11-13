import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ErroApi } from "./api-resposta";

type Bloco = Record<string, unknown>;
export type ItemNotaEntrada = { numero: number; codigo: string | null; gtin: string | null; descricao: string; unidade: string; quantidade: string; valorUnitario: string; valorTotal: string; ncm: string | null; cfop: string | null };
export type NotaEntrada = { chave: string; numero: string; serie: string; ambiente: string; emitidaEm: string; fornecedor: { documento: string; nome: string }; destinatario: { documento: string; nome: string }; total: string; itens: ItemNotaEntrada[] };
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: false });
const invalida = () => new ErroApi("conflito", "A conferência exige XML completo de NF-e autorizada, com identificação e itens válidos.");
function bloco(valor: unknown): Bloco {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw invalida();
  return valor as Bloco;
}
const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : "";
const opcional = (valor: unknown) => texto(valor) || null;
function decimal(valor: unknown, positivo = false) {
  const dado = texto(valor);
  if (!/^\d{1,16}(?:\.\d{1,10})?$/.test(dado) || !Number.isFinite(Number(dado)) || positivo && Number(dado) <= 0) throw invalida();
  return dado;
}
export const normalizarDocumentoEntrada = (valor: string) => valor.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function interpretarNotaEntrada(xml: string): NotaEntrada {
  if (!xml || Buffer.byteLength(xml) > 12 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw invalida();
  const root = bloco((parser.parse(xml) as Bloco).nfeProc);
  const nfe = bloco(bloco(root.NFe).infNFe), ide = bloco(nfe.ide);
  const protocolo = bloco(bloco(root.protNFe).infProt);
  const chave = texto(nfe["@_Id"]).replace(/^NFe/, "");
  if (!/^\d{44}$/.test(chave) || texto(protocolo.chNFe) !== chave || texto(protocolo.cStat) !== "100" || texto(ide.mod) !== "55" || !["1", "2"].includes(texto(ide.tpAmb))) throw invalida();
  const emitente = bloco(nfe.emit), destino = bloco(nfe.dest);
  const linhas = Array.isArray(nfe.det) ? nfe.det : nfe.det ? [nfe.det] : [];
  if (!linhas.length || linhas.length > 990) throw invalida();
  const numeros = new Set<number>();
  const itens = linhas.map(valor => {
    const linha = bloco(valor), produto = bloco(linha.prod);
    const numero = Number(texto(linha["@_nItem"]));
    if (!Number.isInteger(numero) || numero < 1 || numero > 990 || numeros.has(numero) || !texto(produto.xProd) || !texto(produto.uCom)) throw invalida();
    numeros.add(numero);
    const gtin = opcional(produto.cEAN);
    return { numero, codigo: opcional(produto.cProd), gtin: gtin === "SEM GTIN" ? null : gtin, descricao: texto(produto.xProd), unidade: texto(produto.uCom), quantidade: decimal(produto.qCom, true), valorUnitario: decimal(produto.vUnCom), valorTotal: decimal(produto.vProd), ncm: opcional(produto.NCM), cfop: opcional(produto.CFOP) };
  });
  const numero = texto(ide.nNF), serie = texto(ide.serie), emitidaEm = texto(ide.dhEmi ?? ide.dEmi);
  const fornecedor = { documento: normalizarDocumentoEntrada(texto(emitente.CNPJ ?? emitente.CPF)), nome: texto(emitente.xNome) };
  const destinatario = { documento: normalizarDocumentoEntrada(texto(destino.CNPJ ?? destino.CPF)), nome: texto(destino.xNome) };
  if (!numero || !serie || !emitidaEm || !fornecedor.documento || !destinatario.documento) throw invalida();
  return { chave, numero, serie, emitidaEm, ambiente: texto(ide.tpAmb), fornecedor, destinatario, total: decimal(bloco(bloco(nfe.total).ICMSTot).vNF), itens };
}

/** Eventos distribuídos pela SEFAZ são lidos sem enviar manifestação alguma. */
export function eventoCancelaNota(xml: string, chave: string): boolean {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ErroApi("conflito", "Não foi possível conferir os eventos desta NF-e.");
  const root = parser.parse(xml) as Bloco;
  const processo = root.procEventoNFe && typeof root.procEventoNFe === "object" ? root.procEventoNFe as Bloco : null;
  const evento = processo?.evento && typeof processo.evento === "object" ? (processo.evento as Bloco).infEvento : root.resEvento ?? root.resEventoNFe;
  if (!evento || typeof evento !== "object" || Array.isArray(evento)) return false;
  const dados = evento as Bloco;
  const retorno = processo?.retEvento && typeof processo.retEvento === "object" ? (processo.retEvento as Bloco).infEvento as Bloco | undefined : undefined;
  return texto(dados.chNFe) === chave && texto(dados.tpEvento) === "110111" && (!retorno || ["135", "155"].includes(texto(retorno.cStat)));
}
