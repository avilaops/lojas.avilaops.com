import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id } = await params;
  const documento = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id } });
  if (!documento) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  return new Response(documento.xml, { headers: {
    "Content-Type": "application/xml; charset=utf-8",
    "Content-Disposition": `attachment; filename="${documento.nsu}.xml"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
