import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { gerarDanfeCompartilhado } from "@/lib/fiscal-danfe-compartilhado";
import { guardarArquivoFiscal, lerArquivoFiscal } from "@/lib/fiscal-r2";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id } = await params;
  const fiscal = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id } });
  if (!fiscal) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  if (!/^procNFe/i.test(fiscal.schema)) return Response.json({ erro: "Apenas resumo fiscal disponível; XML completo necessário para gerar DANFE." }, { status: 409 });
  try {
    const cnpj = fiscal.cnpj;
    const chave = fiscal.chave;
    let arquivo: Uint8Array | null = null;
    if (/^\d{14}$/.test(cnpj) && /^\d{44}$/.test(chave ?? "")) {
      try { arquivo = await lerArquivoFiscal(cnpj, chave!, "pdf"); }
      catch { console.error("[fiscal] leitura do cache PDF indisponível"); }
    }
    if (!arquivo) {
      arquivo = await gerarDanfeCompartilhado(fiscal.xml);
      if (!arquivo) return Response.json({ erro: "Serviço compartilhado de DANFE não configurado." }, { status: 503 });
      if (/^\d{14}$/.test(cnpj) && /^\d{44}$/.test(chave ?? "")) {
        try { await guardarArquivoFiscal(cnpj, chave!, "pdf", arquivo); }
        catch { console.error("[fiscal] cache PDF indisponível; download mantido"); }
      }
    }
    if (new TextDecoder().decode(arquivo.slice(0, 5)) !== "%PDF-") throw new Error("PDF inválido.");
    const nome = /^\d{44}$/.test(fiscal.chave ?? "") ? fiscal.chave : fiscal.nsu;
    return new Response(new Uint8Array(arquivo), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="DANFE-${nome}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ erro: "Falha ao gerar DANFE no serviço fiscal compartilhado." }, { status: 502 }); }
}
