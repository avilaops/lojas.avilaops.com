import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Prisma } from "@prisma/client";
import { TIPOS_MANIFESTACAO, type TipoManifestacao } from "./fiscal-manifestacao-tipos";

type Db = Pick<Prisma.TransactionClient, "manifestacaoFiscalLoja" | "documentoFiscalLoja" | "auditoriaFiscalLoja">;
type Bloco = Record<string, unknown>;
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: false });
const bloco = (v: unknown): Bloco | null => v && typeof v === "object" && !Array.isArray(v) ? v as Bloco : null;
const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";

function evidencia(xml: string) {
  if (Buffer.byteLength(xml) > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return null;
  try {
    const processo = bloco((parser.parse(xml) as Bloco).procEventoNFe);
    const evento = bloco(bloco(processo?.evento)?.infEvento);
    const retorno = bloco(bloco(processo?.retEvento)?.infEvento);
    if (!evento || !retorno || texto(retorno.cStat) !== "135" || !/^\d{15}$/.test(texto(retorno.nProt))) return null;
    for (const campo of ["tpAmb", "chNFe", "tpEvento", "nSeqEvento"]) if (!texto(evento[campo]) || texto(evento[campo]) !== texto(retorno[campo])) return null;
    if (texto(evento.tpAmb) !== "1" || !/^\d{44}$/.test(texto(evento.chNFe))) return null;
    return { chave: texto(evento.chNFe), autor: texto(evento.CNPJ), codigo: texto(evento.tpEvento), sequencia: texto(evento.nSeqEvento), protocolo: texto(retorno.nProt), motivo: texto(retorno.xMotivo).slice(0, 400) };
  } catch { return null; }
}

/** Somente evidência recebida: nenhuma assinatura ou transmissão ocorre na recuperação. */
export async function reconciliarManifestacoesFiscais(db: Db, tenantId: string, chaves?: string[]): Promise<number> {
  if (chaves && !chaves.length) return 0;
  const pendentes = await db.manifestacaoFiscalLoja.findMany({
    where: { tenantId, ambiente: "PRODUCAO", documento: { tenantId, ...(chaves ? { chave: { in: chaves } } : {}) }, OR: [{ status: { in: ["ENVIANDO", "PENDENTE_CONFERENCIA"] } }, { status: "REJEITADA", codigoRetorno: "573" }] },
    include: { documento: { select: { chave: true, cnpj: true, tenant: { select: { cnpj: true } } } } },
    orderBy: { intencaoEm: "asc" }, take: 100,
  });
  const identidades = [...new Set(pendentes.flatMap(p => p.documento.chave ? [p.documento.chave] : []))];
  if (!identidades.length) return 0;
  const documentos = await db.documentoFiscalLoja.findMany({ where: { tenantId, chave: { in: identidades }, schema: { startsWith: "procEventoNFe" } }, select: { id: true, xml: true } });
  const eventos = documentos.flatMap(d => { const e = evidencia(d.xml); return e ? [{ ...e, documentoId: d.id }] : []; });
  let conciliadas = 0;
  for (const intencao of pendentes) {
    const tipo = Object.hasOwn(TIPOS_MANIFESTACAO, intencao.tipo) ? TIPOS_MANIFESTACAO[intencao.tipo as TipoManifestacao] : null;
    const cnpj = intencao.documento.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase();
    if (!tipo || !cnpj || cnpj !== intencao.documento.cnpj) continue;
    const encontrado = eventos.find(e => e.chave === intencao.documento.chave && e.autor === cnpj && e.codigo === tipo.codigo && e.sequencia === String(intencao.sequencia));
    if (!encontrado) continue;
    const alterada = await db.manifestacaoFiscalLoja.updateMany({ where: { id: intencao.id, tenantId, status: intencao.status }, data: { status: "ACEITA", protocolo: encontrado.protocolo, codigoRetorno: "135", motivoRetorno: encontrado.motivo, resultadoFinal: true, concluidoEm: new Date(), proximaTentativaEm: null } });
    if (!alterada.count) continue;
    await db.auditoriaFiscalLoja.create({ data: { tenantId, documentoId: intencao.documentoId, manifestacaoId: intencao.id, acao: "MANIFESTACAO_CONCILIADA", ator: "sistema:coleta-fiscal", dados: { protocolo: encontrado.protocolo, codigo: encontrado.codigo, eventoDocumentoId: encontrado.documentoId, origem: "EVENTO_DISTRIBUIDO" } } });
    conciliadas++;
  }
  return conciliadas;
}
