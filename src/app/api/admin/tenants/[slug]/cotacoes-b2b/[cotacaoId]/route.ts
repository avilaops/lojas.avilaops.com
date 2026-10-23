import { contextoCotacao, erroCotacao } from "@/lib/cotacoes-b2b-api";
import { expirarCotacoesVencidas, obterCotacaoB2B } from "@/lib/cotacoes-b2b";
type Ctx = { params: Promise<{ slug: string; cotacaoId: string }> };
export async function GET(request: Request, { params }: Ctx) {
  const { slug, cotacaoId } = await params; const contexto = await contextoCotacao(request, slug); if ("resposta" in contexto) return contexto.resposta;
  try { await expirarCotacoesVencidas(contexto.tenant.id); return Response.json(await obterCotacaoB2B(contexto.tenant.id, cotacaoId)); } catch (erro) { return erroCotacao(erro); }
}
