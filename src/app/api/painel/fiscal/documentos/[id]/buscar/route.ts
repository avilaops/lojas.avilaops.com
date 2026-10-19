import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { abrirCertificado, ErroFiscal } from "@/lib/fiscal-certificado";
import { consultarSefazPorChave } from "@/lib/fiscal-distribuicao";
import { validarXmlCompleto } from "@/lib/fiscal-xml-completo";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem não autorizada." }, { status: 403 });
  const { id } = await params;
  const nota = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id }, select: { chave: true, schema: true } });
  const fiscal = await prisma.fiscalLoja.findUnique({ where: { tenantId: s.tenant.id } });
  if (!nota?.chave || !fiscal) return Response.json({ erro: "NF-e ou certificado não encontrados." }, { status: 404 });
  if (/^procNFe/.test(nota.schema)) return Response.json({ disponivel: true });
  const agora = new Date();
  const reserva = await prisma.fiscalLoja.updateMany({
    where: { tenantId: s.tenant.id, proximaConsultaEm: { lte: agora }, validoAte: { gt: agora } },
    data: { proximaConsultaEm: new Date(agora.getTime() + 3_600_000) },
  });
  if (!reserva.count) return Response.json({ erro: "Aguarde o intervalo de consulta da SEFAZ indicado na configuração fiscal." }, { status: 429 });
  let pfx: Buffer | undefined;
  try {
    if (fiscal.cnpj !== s.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase()) throw new ErroFiscal("CNPJ do certificado diverge da loja.");
    const certificado = abrirCertificado(fiscal.certificadoEnc);
    pfx = certificado.pfx;
    const resultado = await consultarSefazPorChave(pfx, certificado.senha, fiscal.cnpj, fiscal.uf, nota.chave);
    const completos = resultado.documentos.filter((d) => /^procNFe/.test(d.schema) && d.chave === nota.chave);
    if (!completos.length) return Response.json({ disponivel: false, mensagem: "A SEFAZ ainda não disponibilizou XML completo. Verifique a manifestação do destinatário ou solicite o XML ao fornecedor." });
    const arquivo = validarXmlCompleto(completos[0].xml, nota.chave, fiscal.cnpj);
    await prisma.documentoFiscalLoja.updateMany({ where: { id, tenantId: s.tenant.id, schema: { startsWith: "resNFe" }, chave: nota.chave }, data: { xml: arquivo.xml, schema: arquivo.schema } });
    return Response.json({ disponivel: true });
  } catch (e) {
    return Response.json({ erro: e instanceof ErroFiscal ? e.message : "Falha na consulta à SEFAZ." }, { status: 422 });
  } finally { pfx?.fill(0); }
}
