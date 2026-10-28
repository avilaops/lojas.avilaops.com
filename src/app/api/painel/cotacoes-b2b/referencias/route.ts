import { exigir } from "@/lib/operadores";
import { referenciasCotacao } from "@/lib/cotacoes-b2b-consulta";
import { erroCotacao } from "@/lib/cotacoes-b2b-api";

export async function GET(request: Request) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  try { return Response.json(await referenciasCotacao(s.tenant.id, new URL(request.url).searchParams)); }
  catch (error) { return erroCotacao(error); }
}
