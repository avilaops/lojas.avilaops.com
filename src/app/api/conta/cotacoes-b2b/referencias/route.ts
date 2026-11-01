import { tenantAtual } from "@/lib/tenant";
import { compradorAtual } from "@/lib/conta";
import { referenciasCotacao } from "@/lib/cotacoes-b2b-consulta";
import { erroCotacao } from "@/lib/cotacoes-b2b-api";

export async function GET(request: Request) {
  const tenant = await tenantAtual();
  if (!tenant) return Response.json({ erro: "Loja não encontrada." }, { status: 404 });
  const comprador = await compradorAtual(tenant);
  if (!comprador) return Response.json({ erro: "Entre na sua conta." }, { status: 401 });
  try { return Response.json(await referenciasCotacao(tenant.id, new URL(request.url).searchParams, comprador.id)); }
  catch (error) { return erroCotacao(error); }
}
