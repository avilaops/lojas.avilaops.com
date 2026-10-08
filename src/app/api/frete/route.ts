import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";
import { buscarCupomValido } from "@/lib/cupons";
import { medirRota } from "@/lib/metricas-rota";

const Entrada = z.object({
  cep: z.string(),
  itens: z.array(z.object({ id: z.string(), quantidade: z.number().int().positive() })).min(1),
  cupom: z.string().max(40).optional(),
});

/** POST { cep, itens:[{id,quantidade}] } → OpcaoFrete[] (cotado no servidor, pelo catálogo). */
export const POST = medirRota("frete", async function (request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "requisição inválida" }, { status: 400 });

  const itens = await resolverItensDoCatalogo(t.id, r.data.itens);
  let freteGratisCupom = false;
  if (r.data.cupom) {
    const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
    const c = await buscarCupomValido(t.id, r.data.cupom, subtotal);
    freteGratisCupom = "cupom" in c && c.cupom.tipo === "FRETE_GRATIS";
  }
  return Response.json(await cotarFrete(t, r.data.cep, itens, { freteGratisCupom }));
});
