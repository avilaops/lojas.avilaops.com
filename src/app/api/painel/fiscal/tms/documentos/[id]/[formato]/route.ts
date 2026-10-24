import { baixarFiscalTms } from "@/lib/tms-fiscal";
import { exigir } from "@/lib/operadores";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; formato: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id, formato } = await params;
  if (formato !== "xml" && formato !== "dacte") return Response.json({ erro: "Arquivo fiscal inválido." }, { status: 404 });
  const cnpj = s.tenant.cnpj?.replace(/\D/g, "") ?? "";
  let upstream: Response | null;
  try { upstream = await baixarFiscalTms(cnpj, id, formato); }
  catch { return Response.json({ erro: "O TMS fiscal está temporariamente indisponível." }, { status: 502 }); }
  if (!upstream) return Response.json({ erro: "Integração fiscal com o TMS não configurada." }, { status: 404 });
  if (!upstream.ok || !upstream.body) return Response.json({ erro: "O TMS não entregou o arquivo fiscal." }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
  return new Response(upstream.body, { headers: { "Content-Type": formato === "xml" ? "application/xml; charset=utf-8" : "application/pdf", "Content-Disposition": `attachment; filename="${formato === "xml" ? "CTe" : "DACTE"}-${id}.${formato === "xml" ? "xml" : "pdf"}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
