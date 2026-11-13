import { ErroApi } from "@/lib/api-resposta";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import { confirmarEntradaFiscal, prepararEntradaFiscal } from "@/lib/fiscal-entrada";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { lerComTeto, UploadInvalido } from "@/lib/limites-upload";
import { exigir, permite } from "@/lib/operadores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
type Contexto = { params: Promise<{ id: string }> };
function falha(erro: unknown) {
  if (erro instanceof ErroApi) return Response.json({ erro: erro.message }, { status: erro.status, headers });
  if (erro instanceof UploadInvalido) return Response.json({ erro: "Conferência acima do limite permitido." }, { status: 413, headers });
  if (erro instanceof SyntaxError) return Response.json({ erro: "Envie JSON válido." }, { status: 400, headers });
  return Response.json({ erro: "Não foi possível concluir a conferência. Consulte a nota antes de tentar novamente." }, { status: 500, headers });
}

export async function GET(_request: Request, contexto: Contexto) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  try { return Response.json(await prepararEntradaFiscal(s.tenant.id, (await contexto.params).id), { headers }); }
  catch (erro) { return falha(erro); }
}

export async function POST(request: Request, contexto: Contexto) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!permite(s.papel, "catalogo") || !origemFiscalPermitida(request)) return Response.json({ erro: "Origem ou permissão da entrada recusada." }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") return Response.json({ erro: "Envie JSON." }, { status: 415, headers });
  try {
    const corpo = JSON.parse((await lerComTeto(request, 256 * 1024)).toString("utf8")) as unknown;
    const recibo = await confirmarEntradaFiscal(s.tenant.id, (await contexto.params).id, corpo, s.operador?.email ?? s.tenant.loginEmail ?? "dono-da-loja");
    try { invalidarCatalogo(s.tenant.id); }
    catch { console.error("[fiscal/entrada] falha na invalidação de cache"); }
    return Response.json(recibo, { headers });
  } catch (erro) { return falha(erro); }
}
