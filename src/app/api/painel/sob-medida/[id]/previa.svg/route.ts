import { gerarPreviaSvgSobMedida } from "@/lib/ficha-tecnica-sob-medida";
import { buscarProjetoSobMedidaNoPainel } from "@/lib/painel-sob-medida";
import { recursoAtivo } from "@/lib/recursos";
import { sessaoDoPainel } from "@/lib/sessao";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoDoPainel();
  if (!sessao) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  if (!recursoAtivo(sessao.tenant, "configurador_sob_medida")) return Response.json({ erro: "Prévia não encontrada." }, { status: 404 });
  const { id } = await params;
  const projeto = await buscarProjetoSobMedidaNoPainel(sessao.tenant.id, id);
  if (!projeto) return Response.json({ erro: "Prévia não encontrada." }, { status: 404 });

  return new Response(gerarPreviaSvgSobMedida(projeto.fichaTecnica), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="${projeto.referencia}.svg"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
