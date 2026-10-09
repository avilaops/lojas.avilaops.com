import { prisma } from "./db";
import { situacaoDaReferencia } from "./pedido-a-confirmar";

/**
 * A resposta de `GET /api/checkout/pendente`, já com a loja resolvida.
 *
 * Fica fora da rota para ter teste contra o banco: a rota resolve a loja pelo
 * `headers()` do Next, que só responde dentro do servidor.
 *
 * Só leitura, só da própria loja, e responde apenas a situação: referência de
 * outra loja é igual a referência que não existe.
 */
export async function responderPendencia(loja: { id: string } | null, url: string): Promise<Response> {
  if (!loja) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const referencia = new URL(url).searchParams.get("referencia")?.trim() ?? "";
  // Mesmo intervalo que `CorpoDoCheckout` aceita: fora dele nunca houve tentativa.
  if (referencia.length < 16 || referencia.length > 120) return Response.json({ erro: "referência inválida" }, { status: 400 });
  const [pedido, tentativa] = await Promise.all([
    prisma.pedido.findFirst({ where: { tenantId: loja.id, referencia }, select: { status: true } }),
    prisma.tentativaCatalogo.findUnique({ where: { tenantId_referencia: { tenantId: loja.id, referencia } }, select: { estado: true } }),
  ]);
  return Response.json({ situacao: situacaoDaReferencia(pedido?.status, tentativa?.estado) }, { headers: { "cache-control": "no-store" } });
}
