import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { lerArquivoFiscal } from "@/lib/fiscal-r2";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id } = await params;
  const documento = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id } });
  if (!documento) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  let conteudo: string | Uint8Array = documento.xml;
  if (documento.arquivadoEm && /^procNFe/.test(documento.schema) && /^\d{14}$/.test(documento.cnpj) && /^\d{44}$/.test(documento.chave ?? "")) {
    try { conteudo = await lerArquivoFiscal(documento.cnpj, documento.chave!, "xml") ?? documento.xml; }
    catch { console.error("[fiscal] cache XML indisponível; usando banco"); }
  }
  return new Response(conteudo, { headers: {
    "Content-Type": "application/xml; charset=utf-8",
    "Content-Disposition": `attachment; filename="${documento.nsu}.xml"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
