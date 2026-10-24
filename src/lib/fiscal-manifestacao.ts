import { createHash, createSign } from "node:crypto";
import { request } from "node:https";
import { prisma } from "./db";
import { abrirCertificado, credencialAssinatura, credencialTls, ErroFiscal, lerCertificado } from "./fiscal-certificado";
import { consultarSefazPorChave } from "./fiscal-distribuicao";
import { cabecalhoDocumentoFiscal } from "./fiscal-documento";

const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
const DSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const WSDL = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4";
const ENDPOINT = "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";

export const TIPOS_MANIFESTACAO = {
  CIENCIA: { codigo: "210210", descricao: "Ciencia da Operacao" },
  CONFIRMACAO: { codigo: "210200", descricao: "Confirmacao da Operacao" },
  DESCONHECIMENTO: { codigo: "210220", descricao: "Desconhecimento da Operacao" },
  NAO_REALIZADA: { codigo: "210240", descricao: "Operacao nao Realizada" },
} as const;
export type TipoManifestacao = keyof typeof TIPOS_MANIFESTACAO;

const escape = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pick = (xml: string, nome: string) => new RegExp(`<(?:\\w+:)?${nome}>([^<]*)</(?:\\w+:)?${nome}>`).exec(xml)?.[1] ?? null;

function instanteFiscal(data: Date): string {
  const local = new Date(data.getTime() - 3 * 60 * 60_000).toISOString().slice(0, 19);
  return `${local}-03:00`;
}

export function montarManifestacao(dados: { tipo: TipoManifestacao; chave: string; cnpj: string; sequencia: number; data: Date; justificativa?: string | null }) {
  if (!/^\d{44}$/.test(dados.chave) || !/^[0-9A-Z]{12}\d{2}$/.test(dados.cnpj)) throw new ErroFiscal("Chave ou CNPJ inválido para manifestação.");
  if (!Number.isInteger(dados.sequencia) || dados.sequencia < 1 || dados.sequencia > 20) throw new ErroFiscal("Sequência de manifestação inválida.");
  const tipo = TIPOS_MANIFESTACAO[dados.tipo];
  const justificativa = dados.justificativa?.replace(/\s+/g, " ").trim() ?? "";
  if (dados.tipo === "NAO_REALIZADA" && (justificativa.length < 15 || justificativa.length > 255)) {
    throw new ErroFiscal("Informe a justificativa da operação não realizada com 15 a 255 caracteres.");
  }
  const id = `ID${tipo.codigo}${dados.chave}${String(dados.sequencia).padStart(2, "0")}`;
  const detalhe = `<descEvento>${tipo.descricao}</descEvento>${dados.tipo === "NAO_REALIZADA" ? `<xJust>${escape(justificativa)}</xJust>` : ""}`;
  const corpo = `<cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>${dados.cnpj}</CNPJ><chNFe>${dados.chave}</chNFe><dhEvento>${instanteFiscal(dados.data)}</dhEvento><tpEvento>${tipo.codigo}</tpEvento><nSeqEvento>${dados.sequencia}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00">${detalhe}</detEvento>`;
  return { id, xml: `<evento xmlns="${NFE_NS}" versao="1.00"><infEvento Id="${id}">${corpo}</infEvento></evento>` };
}

export function assinarManifestacao(xml: string, id: string, chavePrivada: string, certificado: string): string {
  const correspondencia = new RegExp(`^<evento xmlns="${NFE_NS}" versao="1\\.00"><infEvento Id="${id}">([\\s\\S]+)</infEvento></evento>$`).exec(xml);
  if (!correspondencia) throw new ErroFiscal("O XML da manifestação não corresponde ao evento preparado.");
  const canonico = `<infEvento xmlns="${NFE_NS}" Id="${id}">${correspondencia[1]}</infEvento>`;
  const digest = createHash("sha1").update(canonico, "utf8").digest("base64");
  const signedInfo = (namespace: string) => `<SignedInfo${namespace}><CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${id}"><Transforms><Transform Algorithm="${ENVELOPED}"></Transform><Transform Algorithm="${C14N}"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
  const assinatura = createSign("RSA-SHA1").update(signedInfo(` xmlns="${DSIG_NS}"`), "utf8").sign(chavePrivada, "base64");
  const x509 = certificado.replace(/-----[^-]+-----|\s+/g, "");
  const signature = `<Signature xmlns="${DSIG_NS}">${signedInfo("")}<SignatureValue>${assinatura}</SignatureValue><KeyInfo><X509Data><X509Certificate>${x509}</X509Certificate></X509Data></KeyInfo></Signature>`;
  return xml.replace("</evento>", `${signature}</evento>`);
}

export function envelopeManifestacao(xmlAssinado: string, lote: string): string {
  if (!/^\d{1,15}$/.test(lote) || !xmlAssinado.includes("<Signature ")) throw new ErroFiscal("Lote ou assinatura da manifestação inválidos.");
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="${WSDL}"><envEvento xmlns="${NFE_NS}" versao="1.00"><idLote>${lote}</idLote>${xmlAssinado}</envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

export function lerRetornoManifestacao(xml: string, chave: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<retEnvEvento\b/.test(xml)) throw new ErroFiscal("A resposta da SEFAZ para a manifestação é inválida.");
  const evento = /<retEvento\b[\s\S]*?<\/retEvento>/.exec(xml)?.[0];
  if (!evento) return { aceita: false, codigo: pick(xml, "cStat") ?? "", motivo: pick(xml, "xMotivo") ?? "", protocolo: null };
  if ((pick(evento, "chNFe") ?? chave) !== chave) throw new ErroFiscal("A SEFAZ respondeu sobre outra NF-e.");
  const codigo = pick(evento, "cStat") ?? "";
  const protocolo = pick(evento, "nProt");
  return { aceita: codigo === "135" && !!protocolo, codigo, motivo: pick(evento, "xMotivo") ?? "", protocolo };
}

async function enviar(pfx: Buffer, senha: string, corpo: string): Promise<string> {
  const credencial = credencialTls(pfx, senha);
  return new Promise<string>((resolve, reject) => {
    const req = request(ENDPOINT, { method: "POST", ...credencial, headers: { "Content-Type": `application/soap+xml; charset=utf-8; action="${WSDL}/nfeRecepcaoEvento"`, "Content-Length": Buffer.byteLength(corpo) } }, (res) => {
      const partes: Buffer[] = []; let tamanho = 0;
      res.on("data", (parte: Buffer) => { tamanho += parte.length; if (tamanho > 2 * 1024 * 1024) req.destroy(new Error("Resposta excessiva")); else partes.push(parte); });
      res.on("error", reject);
      res.on("end", () => res.statusCode === 200 ? resolve(Buffer.concat(partes).toString("utf8")) : reject(new Error("Falha HTTP")));
    });
    const prazo = setTimeout(() => req.destroy(new Error("Prazo excedido")), 30_000);
    req.on("close", () => clearTimeout(prazo)); req.on("error", reject); req.end(corpo);
  }).catch(() => { throw new ErroFiscal("Não foi possível confirmar a manifestação na SEFAZ. A intenção foi preservada para conferência."); });
}

export async function manifestarDocumento(dados: { tenantId: string; documentoId: string; tipo: TipoManifestacao; justificativa?: string | null; autor: string; agora?: Date }) {
  const documento = await prisma.documentoFiscalLoja.findFirst({ where: { id: dados.documentoId, tenantId: dados.tenantId }, select: { id: true, chave: true, schema: true, destinatarioDocumento: true } });
  const fiscal = await prisma.fiscalLoja.findUnique({ where: { tenantId: dados.tenantId }, include: { tenant: { select: { cnpj: true, status: true } } } });
  if (!documento || !documento.chave || !/^resNFe/i.test(documento.schema)) throw new ErroFiscal("A manifestação exige um resumo de NF-e recebido por esta loja.");
  if (!fiscal || fiscal.tenant.status !== "ATIVA") throw new ErroFiscal("Configure o certificado A1 da loja antes de manifestar.");
  const cnpj = fiscal.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase() ?? "";
  if (fiscal.cnpj !== cnpj || (documento.destinatarioDocumento && documento.destinatarioDocumento !== cnpj)) throw new ErroFiscal("O destinatário da NF-e não corresponde ao certificado desta loja.");
  const sequencia = 1;
  const idempotencia = `NFE:${documento.chave}:${TIPOS_MANIFESTACAO[dados.tipo].codigo}:${sequencia}:PRODUCAO`;
  const existente = await prisma.manifestacaoFiscalLoja.findUnique({ where: { tenantId_idempotencia: { tenantId: dados.tenantId, idempotencia } } });
  if (existente) return existente;
  const registro = await prisma.manifestacaoFiscalLoja.create({ data: { tenantId: dados.tenantId, documentoId: documento.id, idempotencia, tipo: dados.tipo, justificativa: dados.justificativa, autor: dados.autor, ambiente: "PRODUCAO", sequencia } });
  let pfx: Buffer | undefined;
  try {
    const aberto = abrirCertificado(fiscal.certificadoEnc); pfx = aberto.pfx;
    lerCertificado(pfx, aberto.senha, cnpj);
    const preparado = montarManifestacao({ tipo: dados.tipo, chave: documento.chave, cnpj, sequencia, data: dados.agora ?? new Date(), justificativa: dados.justificativa });
    const chave = credencialAssinatura(pfx, aberto.senha);
    const assinado = assinarManifestacao(preparado.xml, preparado.id, chave.key, chave.cert);
    const lote = String(Date.now()).slice(-15);
    const requisicao = envelopeManifestacao(assinado, lote);
    await prisma.manifestacaoFiscalLoja.update({ where: { id: registro.id }, data: { lote, enviadoEm: new Date(), status: "ENVIANDO", tentativas: { increment: 1 }, xmlEnviado: assinado } });
    const resposta = await enviar(pfx, aberto.senha, requisicao);
    const retorno = lerRetornoManifestacao(resposta, documento.chave);
    const final = await prisma.manifestacaoFiscalLoja.update({ where: { id: registro.id }, data: { concluidoEm: new Date(), protocolo: retorno.protocolo, status: retorno.aceita ? "ACEITA" : "REJEITADA", codigoRetorno: retorno.codigo, motivoRetorno: retorno.motivo.slice(0, 400), xmlResposta: resposta, resultadoFinal: true } });
    await prisma.auditoriaFiscalLoja.create({ data: { tenantId: dados.tenantId, documentoId: documento.id, manifestacaoId: registro.id, acao: retorno.aceita ? "MANIFESTACAO_ACEITA" : "MANIFESTACAO_REJEITADA", ator: dados.autor, dados: { tipo: dados.tipo, codigo: retorno.codigo, protocolo: retorno.protocolo } } });
    if (retorno.aceita) {
      try {
        const distribuicao = await consultarSefazPorChave(pfx, aberto.senha, cnpj, fiscal.uf, documento.chave);
        if (distribuicao.documentos.length) await prisma.documentoFiscalLoja.createMany({ data: distribuicao.documentos.map((item) => ({ ...item, ...cabecalhoDocumentoFiscal(item.xml, item.schema, item.chave), tenantId: dados.tenantId, cnpj, hashXml: createHash("sha256").update(item.xml, "utf8").digest("hex"), identificadorExterno: `SEFAZ_NFE:${cnpj}:${item.nsu}` })), skipDuplicates: true });
      } catch (erroDistribuicao) {
        await prisma.auditoriaFiscalLoja.create({ data: { tenantId: dados.tenantId, documentoId: documento.id, manifestacaoId: registro.id, acao: "XML_COMPLETO_AGUARDANDO", ator: dados.autor, dados: { motivo: erroDistribuicao instanceof ErroFiscal ? erroDistribuicao.message : "Consulta por chave pendente." } } });
      }
    }
    return final;
  } catch (erro) {
    await prisma.manifestacaoFiscalLoja.update({ where: { id: registro.id }, data: { status: "PENDENTE_CONFERENCIA", proximaTentativaEm: new Date(Date.now() + 60 * 60_000), motivoRetorno: erro instanceof ErroFiscal ? erro.message : "Falha protegida no envio fiscal." } });
    throw erro;
  } finally { pfx?.fill(0); }
}
