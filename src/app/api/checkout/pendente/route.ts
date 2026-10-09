import { tenantAtual } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { medirRota } from "@/lib/metricas-rota";
import { situacaoDaReferencia } from "@/lib/pedido-a-confirmar";

/**
 * GET ?referencia=<referência> — o /checkout pergunta se a referência que
 * ficou pendente no navegador já resolveu, antes de abrir o formulário.
 *
 * Só leitura, só da própria loja, e responde apenas a situação: o mesmo que a
 * página `/pedido/[referencia]` já revela a quem tem a referência.
 */
export const GET = medirRota("checkout", async function (request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const referencia = new URL(request.url).searchParams.get("referencia")?.trim() ?? "";
  // Mesmo intervalo que `CorpoDoCheckout` aceita: fora dele nunca houve tentativa.
  if (referencia.length < 16 || referencia.length > 120) return Response.json({ erro: "referência inválida" }, { status: 400 });
  const [pedido, tentativa] = await Promise.all([
    prisma.pedido.findFirst({ where: { tenantId: t.id, referencia }, select: { status: true } }),
    prisma.tentativaCatalogo.findUnique({ where: { tenantId_referencia: { tenantId: t.id, referencia } }, select: { estado: true } }),
  ]);
  return Response.json({ situacao: situacaoDaReferencia(pedido?.status, tentativa?.estado) }, { headers: { "cache-control": "no-store" } });
});
