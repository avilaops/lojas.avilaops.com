import { baixarFiscalErp } from "@/lib/erp-fiscal";
import { exigir } from "@/lib/operadores";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; formato: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id, formato } = await params;
  if (formato !== "xml" && formato !== "danfe") return Response.json({ erro: "Arquivo fiscal inválido." }, { status: 404 });
  const cnpj = s.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase() ?? "";
  let upstream: Response | null;
  try { upstream = await baixarFiscalErp(cnpj, id, formato); }
  catch { return Response.json({ erro: "O ERP fiscal está temporariamente indisponível." }, { status: 502 }); }
  if (!upstream) return Response.json({ erro: "Integração fiscal com o ERP não configurada." }, { status: 404 });
  if (!upstream.ok || !upstream.body) return Response.json({ erro: "O ERP não entregou o arquivo fiscal." }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
  return new Response(upstream.body, { status: 200, headers: { "Content-Type": formato === "xml" ? "application/xml; charset=utf-8" : "application/pdf", "Content-Disposition": `${formato === "xml" ? "attachment" : "inline"}; filename="NF-e-${id}.${formato === "xml" ? "xml" : "pdf"}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
