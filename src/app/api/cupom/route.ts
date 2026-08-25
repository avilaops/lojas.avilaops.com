import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { MENSAGEM_CUPOM, buscarCupomValido, descontoDoCupom } from "@/lib/cupons";

const Entrada = z.object({ codigo: z.string().min(1).max(40), itens: z.array(z.object({ id: z.string(), quantidade: z.number().int().positive() })).min(1) });

/** POST { codigo, itens } → { codigo, tipo, desconto } ou { erro }. Só informa; o checkout recalcula. */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Informe o cupom." }, { status: 400 });
  const itens = await resolverItensDoCatalogo(t.id, r.data.itens);
  const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const res = await buscarCupomValido(t.id, r.data.codigo, subtotal);
  if ("erro" in res) return Response.json({ erro: MENSAGEM_CUPOM[res.erro] + (res.minimo ? ` (mínimo R$ ${(res.minimo / 100).toFixed(2).replace(".", ",")})` : "") }, { status: 422 });
  return Response.json({ codigo: res.cupom.codigo, tipo: res.cupom.tipo, desconto: descontoDoCupom(res.cupom, itens) });
}
