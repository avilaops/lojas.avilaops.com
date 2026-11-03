import { exigir } from "@/lib/operadores";
import { ConsultaEtiquetas } from "@/lib/etiquetas";
import { consultarEtiquetas } from "@/lib/etiquetas-catalogo";

export async function GET(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const entrada = ConsultaEtiquetas.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!entrada.success) return Response.json({ erro: "Busca de etiquetas inválida." }, { status: 422 });
  const resultado = await consultarEtiquetas(s.tenant.id, entrada.data);
  return Response.json(resultado, { headers: { "Cache-Control": "private, no-store" } });
}
