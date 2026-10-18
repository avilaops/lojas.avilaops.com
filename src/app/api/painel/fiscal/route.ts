import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { chaveFiscal, ErroFiscal, lerCertificado, selarCertificado } from "@/lib/fiscal-certificado";
import { UFS_FISCAIS } from "@/lib/fiscal-distribuicao";
import { RESUMO_FISCAL, sincronizarNotas } from "@/lib/fiscal-loja";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { resumirDocumentoFiscal } from "@/lib/fiscal-documento";
import { buscarFiscalErp } from "@/lib/erp-fiscal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ufDaEmpresa(endereco: unknown): string {
  if (!endereco || typeof endereco !== "object" || Array.isArray(endereco)) return "";
  const uf = String((endereco as Record<string, unknown>).uf ?? "").trim().toUpperCase();
  return UFS_FISCAIS[uf] ? uf : "";
}

async function estado(tenantId: string, endereco: unknown) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { cnpj: true } });
  const cnpj = tenant?.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase() ?? "";
  const [configuracao, documentos, erp] = await Promise.all([
    prisma.fiscalLoja.findUnique({ where: { tenantId }, select: RESUMO_FISCAL }),
    prisma.documentoFiscalLoja.findMany({ where: { tenantId }, select: { id: true, cnpj: true, nsu: true, schema: true, chave: true, xml: true, recebidoEm: true }, orderBy: [{ recebidoEm: "desc" }, { nsu: "desc" }], take: 100 }),
    cnpj ? buscarFiscalErp(cnpj).catch((erro) => ({ erro: erro instanceof Error ? erro.message : "ERP fiscal indisponível." })) : null,
  ]);
  return {
    configuracao,
    documentos: documentos.map(({ xml, ...documento }) => ({ ...documento, ...resumirDocumentoFiscal(xml, documento.schema, documento.chave) })),
    ufEmpresa: ufDaEmpresa(endereco),
    erp,
  };
}

export async function GET() {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  return Response.json(await estado(s.tenant.id, s.tenant.endereco), { headers: { "Cache-Control": "no-store" } });
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
