import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { chaveFiscal, ErroFiscal, lerCertificado, selarCertificado } from "@/lib/fiscal-certificado";
import { UFS_FISCAIS } from "@/lib/fiscal-distribuicao";
import { RESUMO_FISCAL, sincronizarNotas } from "@/lib/fiscal-loja";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { resumirDocumentoFiscal } from "@/lib/fiscal-documento";
import { totalizarDocumentosFiscais } from "@/lib/fiscal-monitor";
import { filtrosFiscais } from "@/lib/fiscal-filtros";
import { buscarFiscalErp } from "@/lib/erp-fiscal";
import { buscarFiscalTms } from "@/lib/tms-fiscal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ufDaEmpresa(endereco: unknown): string {
  if (!endereco || typeof endereco !== "object" || Array.isArray(endereco)) return "";
  const uf = String((endereco as Record<string, unknown>).uf ?? "").trim().toUpperCase();
  return UFS_FISCAIS[uf] ? uf : "";
}

async function estado(tenantId: string, endereco: unknown, parametros?: URLSearchParams) {
  const { where, pagina, limite } = filtrosFiscais(tenantId, parametros);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { cnpj: true } });
  const cnpj = tenant?.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase() ?? "";
  const [configuracao, documentos, total, erp, tms, contagens] = await Promise.all([
    prisma.fiscalLoja.findUnique({ where: { tenantId }, select: RESUMO_FISCAL }),
    prisma.documentoFiscalLoja.findMany({ where, select: { id: true, cnpj: true, nsu: true, schema: true, chave: true, xml: true, recebidoEm: true, manifestacoes: { orderBy: { intencaoEm: "desc" }, take: 1, select: { status: true, codigoRetorno: true, motivoRetorno: true, protocolo: true } } }, orderBy: [{ recebidoEm: "desc" }, { nsu: "desc" }, { id: "desc" }], skip: (pagina - 1) * limite, take: limite }),
    prisma.documentoFiscalLoja.count({ where }),
    cnpj ? buscarFiscalErp(cnpj).catch((erro) => ({ erro: erro instanceof Error ? erro.message : "ERP fiscal indisponível." })) : null,
    cnpj ? buscarFiscalTms(cnpj).catch((erro) => ({ erro: erro instanceof Error ? erro.message : "TMS fiscal indisponível." })) : null,
    prisma.documentoFiscalLoja.groupBy({ where: { tenantId }, by: ["schema"], _count: { _all: true } }),
  ]);
  // Alguns XMLs completos chegaram em outro NSU: vincular pelo par tenant/chave.
  const chaves = [...new Set(documentos.filter(d => /^resNFe/.test(d.schema) && d.chave).map(d => d.chave!))];
  const completos = chaves.length ? await prisma.documentoFiscalLoja.findMany({
    where: { tenantId, chave: { in: chaves }, schema: { startsWith: "procNFe" } },
    select: { id: true, chave: true }, orderBy: { recebidoEm: "desc" }, take: 250,
  }) : [];
  const completosPorChave = new Map<string, string>();
  for (const completo of completos) {
    if (completo.chave && !completosPorChave.has(completo.chave)) completosPorChave.set(completo.chave, completo.id);
  }
  return {
    configuracao,
    documentos: documentos.map(({ xml, manifestacoes, ...documento }) => {
      const resumo = resumirDocumentoFiscal(xml, documento.schema, documento.chave);
      const completoId = documento.chave && /^resNFe/.test(documento.schema) ? completosPorChave.get(documento.chave) ?? null : null;
      const enviada = manifestacoes[0] ?? null;
      const manifestacaoEnvio = enviada ? { status: enviada.status, codigo: enviada.codigoRetorno, motivo: enviada.motivoRetorno, protocolo: enviada.protocolo } : null;
      return { ...documento, ...resumo, manifestacaoEnvio, completoId, situacao: completoId ? "COMPLETA" as const : resumo.situacao };
    }),
    totais: { ...totalizarDocumentosFiscais(contagens.map(({ schema, _count }) => ({ schema, quantidade: _count._all }))), completas: contagens.filter(({ schema }) => /^procNFe/i.test(schema)).reduce((total, { _count }) => total + _count._all, 0) },
    ufEmpresa: ufDaEmpresa(endereco),
    pagina, total, paginas: Math.max(1, Math.ceil(total / limite)),
    erp,
    tms,
  };
}

export async function GET(request: Request) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  return Response.json(await estado(s.tenant.id, s.tenant.endereco, new URL(request.url).searchParams), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) {
    return Response.json({ erro: "Por segurança, o envio foi bloqueado. Reabra o painel e tente novamente." }, { status: 403 });
  }
  try {
    if (new URL(request.url).searchParams.get("acao") === "consultar") {
      const resultado = await sincronizarNotas(s.tenant.id);
      return Response.json({ ...await estado(s.tenant.id, s.tenant.endereco), resultado });
    }
    chaveFiscal();
    const reader = request.body?.getReader();
    if (!reader) throw new ErroFiscal("Envie o certificado A1.");
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > 96 * 1024) { await reader.cancel(); throw new ErroFiscal("Envie um certificado A1 de até 64 KB."); }
      partes.push(value);
    }
    const form = await new Response(Buffer.concat(partes), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const arquivo = form.get("certificado");
    const senha = form.get("senha");
    const uf = ufDaEmpresa(s.tenant.endereco);
    if (!(arquivo instanceof File) || typeof senha !== "string" || senha.length > 1024) throw new ErroFiscal("Informe o certificado A1 e a senha.");
    if (!uf) throw new ErroFiscal("Cadastre a UF em Dados da empresa antes de guardar o certificado.");
    const cnpj = s.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase() ?? "";
    const pfx = Buffer.from(await arquivo.arrayBuffer());
    try {
      const info = lerCertificado(pfx, senha, cnpj);
      const existente = await prisma.fiscalLoja.findUnique({ where: { tenantId: s.tenant.id }, select: { cnpj: true } });
      if (existente && existente.cnpj !== cnpj) throw new ErroFiscal("A troca de CNPJ exige revisão do controle fiscal pelo suporte.");
      const dados = { cnpj, uf, ...info, certificadoEnc: selarCertificado(pfx, senha) };
      await prisma.fiscalLoja.upsert({ where: { tenantId: s.tenant.id }, create: { tenantId: s.tenant.id, ...dados }, update: dados });
    } finally { pfx.fill(0); }
    return Response.json(await estado(s.tenant.id, s.tenant.endereco));
  } catch (erro) {
    const mensagem = erro instanceof ErroFiscal ? erro.message : "Não foi possível concluir a operação fiscal. Confira se este CNPJ já está configurado em outra loja e contate o suporte se persistir.";
    return Response.json({ erro: mensagem }, { status: 422 });
  }
}
