import { request } from "node:https";
import { gunzipSync } from "node:zlib";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ErroFiscal } from "./fiscal-certificado";

export const UFS_FISCAIS: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};
const NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";
const URL_SEFAZ = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: false });

function validarXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new ErroFiscal("A SEFAZ devolveu um XML inválido.");
  }
}

export function envelopeDistribuicao(cnpj: string, uf: string, nsu: string): string {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || !UFS_FISCAIS[uf] || !/^\d{15}$/.test(nsu)) {
    throw new ErroFiscal("CNPJ, UF ou controle de consulta inválido.");
  }
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresse xmlns="${NS}"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>${UFS_FISCAIS[uf]}</cUFAutor><CNPJ>${cnpj}</CNPJ><distNSU><ultNSU>${nsu}</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap:Body></soap:Envelope>`;
}

export function lerDistribuicao(xml: string) {
  validarXml(xml);
  const body = parser.parse(xml).Envelope?.Body;
  let resultado = body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult;
  if (typeof resultado === "string") {
    // Há versões do serviço que encapsulam o XML como texto.
    resultado = resultado.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    validarXml(resultado);
    resultado = parser.parse(resultado);
  }
  const retorno = resultado?.retDistDFeInt;
  if (!retorno || !/^\d{3}$/.test(retorno.cStat ?? "")) throw new ErroFiscal("Resposta de distribuição não reconhecida.");
  const status = String(retorno.cStat);
  const mensagem = String(retorno.xMotivo ?? "Resposta da SEFAZ").slice(0, 400);
  if (!["137", "138", "656"].includes(status)) throw new ErroFiscal(`SEFAZ ${status}: ${mensagem}`);
  const ultimoNsu = String(retorno.ultNSU ?? "");
  const maxNsu = String(retorno.maxNSU ?? "");
  if (status !== "656" && (!/^\d{15}$/.test(ultimoNsu) || !/^\d{15}$/.test(maxNsu) || ultimoNsu > maxNsu)) {
    throw new ErroFiscal("A SEFAZ devolveu um controle de consulta inválido.");
  }
  const lote = retorno.loteDistDFeInt?.docZip;
  const itens = lote ? (Array.isArray(lote) ? lote : [lote]) : [];
  if (itens.length > 50) throw new ErroFiscal("Lote da SEFAZ acima do limite esperado.");
  const documentos = itens.map((item: Record<string, string>) => {
    const nsu = String(item["@_NSU"] ?? "");
    const schema = String(item["@_schema"] ?? "");
    if (!/^\d{15}$/.test(nsu) || !/^[\w.-]+\.xsd$/.test(schema)) throw new ErroFiscal("Documento fiscal sem identificação válida.");
    const conteudo = gunzipSync(Buffer.from(String(item["#text"] ?? ""), "base64"), { maxOutputLength: 2 * 1024 * 1024 }).toString("utf8");
    validarXml(conteudo);
    const chave = /<(?:\w+:)?chNFe>\s*(\d{44})\s*<\//.exec(conteudo)?.[1]
      ?? /\bId=["']NFe(\d{44})["']/.exec(conteudo)?.[1] ?? null;
    return { nsu, schema, xml: conteudo, chave };
  });
  if (status === "138" && (!documentos.length || documentos.some((doc) => doc.nsu > ultimoNsu))) {
    throw new ErroFiscal("Lote da SEFAZ inconsistente com o controle de consulta.");
  }
  return { status, mensagem, ultimoNsu, maxNsu, documentos };
}

/** Um lote por chamada; nunca desliga a validação TLS nem segue redirecionamento. */
export async function consultarSefaz(pfx: Buffer, senha: string, cnpj: string, uf: string, nsu: string) {
  const corpo = envelopeDistribuicao(cnpj, uf, nsu);
  const xml = await new Promise<string>((resolve, reject) => {
    const req = request(URL_SEFAZ, {
      method: "POST", pfx, passphrase: senha,
      headers: { "Content-Type": `application/soap+xml; charset=utf-8; action="${NS}/nfeDistDFeInteresse"`, "Content-Length": Buffer.byteLength(corpo) },
    }, (res) => {
      const partes: Buffer[] = [];
      let tamanho = 0;
      res.on("data", (parte: Buffer) => {
        tamanho += parte.length;
        if (tamanho > 8 * 1024 * 1024) req.destroy(new Error("Resposta excessiva"));
        else partes.push(parte);
      });
      res.on("error", reject);
      res.on("end", () => res.statusCode === 200 ? resolve(Buffer.concat(partes).toString("utf8")) : reject(new Error("Falha HTTP")));
    });
    const prazo = setTimeout(() => req.destroy(new Error("Prazo excedido")), 25_000);
    req.on("close", () => clearTimeout(prazo));
    req.on("error", reject);
    req.end(corpo);
  }).catch(() => { throw new ErroFiscal("Não foi possível consultar a SEFAZ. Uma nova tentativa será liberada em uma hora."); });
  return lerDistribuicao(xml);
}
