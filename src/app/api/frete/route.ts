import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";

const Entrada = z.object({
  cep: z.string(),
  itens: z.array(z.object({ id: z.string(), quantidade: z.number().int().positive() })).min(1),
});

/** POST { cep, itens:[{id,quantidade}] } → OpcaoFrete[] (cotado no servidor, pelo catálogo). */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "requisição inválida" }, { status: 400 });

  const itens = await resolverItensDoCatalogo(t.id, r.data.itens);
  return Response.json(await cotarFrete(t, r.data.cep, itens));
}
