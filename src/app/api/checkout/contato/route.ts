import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { registrarCheckoutAberto } from "@/lib/carrinhos";

const Entrada = z.object({
  referencia: z.string().min(6).max(80),
  cliente: z.object({ nome: z.string().trim().min(1).max(80), sobrenome: z.string().trim().max(80).default(""), email: z.string().email(), telefone: z.string().min(10).max(20) }),
  itens: z.array(z.object({ id: z.string(), quantidade: z.number().int().positive() })).min(1),
});

/** POST — a pessoa se identificou no checkout; registra para o carrinho abandonado. */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ ok: false }, { status: 400 });
  const itens = await resolverItensDoCatalogo(t.id, r.data.itens);
  if (!itens.length) return Response.json({ ok: false });
  await registrarCheckoutAberto(t, {
    referencia: r.data.referencia,
    clienteNome: `${r.data.cliente.nome} ${r.data.cliente.sobrenome}`.trim(),
    clienteEmail: r.data.cliente.email.toLowerCase(),
    clienteTelefone: r.data.cliente.telefone.replace(/\D/g, ""),
    itens: itens.map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
  });
  return Response.json({ ok: true });
}
