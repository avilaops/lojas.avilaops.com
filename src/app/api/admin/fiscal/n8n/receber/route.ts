import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ErroRecepcaoFiscal, ReceberFiscalN8n, receberFiscalNoN8n } from "@/lib/fiscal-n8n";

export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const r = ReceberFiscalN8n.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados de recepção inválidos." }, { status: 422 });
  try { return Response.json(await receberFiscalNoN8n(r.data), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) {
    if (e instanceof ErroRecepcaoFiscal) return Response.json({ erro: e.message }, { status: e.status });
    throw e;
  }
}
