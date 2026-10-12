import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { avisarEnvio, bloqueioDeEtiqueta, emitirEtiqueta } from "@/lib/postagem";

/**
 * POST — gera a etiqueta de um pedido pago.
 *
 * A etiqueta sai da carteira da Avila Ops e fica registrada como valor a
 * acertar com a loja. Só pedido pago gera: antes disso o dinheiro do frete
 * ainda não entrou na conta do lojista.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const { id } = await params;

  const pedido = await prisma.pedido.findFirst({
    where: { id, tenantId: loja.id },
    include: { itens: true },
  });
  if (!pedido) return Response.json({ erro: "Pedido não encontrado." }, { status: 404 });
  const bloqueio = bloqueioDeEtiqueta(pedido.status);
  if (bloqueio) return Response.json({ erro: bloqueio }, { status: 409 });

  try {
    const r = await emitirEtiqueta(loja, pedido);
    // O aviso ao comprador só sai quando existe rastreio de verdade.
    if (r.status === "emitida" && r.codigoObjeto && !pedido.rastreio) {
      await avisarEnvio(loja, pedido, r.codigoObjeto);
    }
    return Response.json(r);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao gerar a etiqueta." }, { status: 502 });
  }
}
