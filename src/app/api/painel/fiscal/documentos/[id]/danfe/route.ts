import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { gerarDanfeCompartilhado } from "@/lib/fiscal-danfe-compartilhado";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id } = await params;
  const fiscal = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id } });
  if (!fiscal) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  if (!/^procNFe/i.test(fiscal.schema)) return Response.json({ erro: "Apenas resumo fiscal disponível; XML completo necessário para gerar DANFE." }, { status: 409 });
  try {
    const arquivo = await gerarDanfeCompartilhado(fiscal.xml);
    if (!arquivo) return Response.json({ erro: "Serviço compartilhado de DANFE não configurado." }, { status: 503 });
    const nome = /^\d{44}$/.test(fiscal.chave ?? "") ? fiscal.chave : fiscal.nsu;
    return new Response(arquivo, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="DANFE-${nome}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ erro: "Falha ao gerar DANFE no serviço fiscal compartilhado." }, { status: 502 }); }
}
