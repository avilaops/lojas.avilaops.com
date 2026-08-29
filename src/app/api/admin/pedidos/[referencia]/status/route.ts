import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ referencia: string }> };

/**
 * GET — só o estado de um pedido, pela referência (única na plataforma).
 *
 * É o que o lembrete de PIX do n8n consulta 30 min depois de `pedido.criado`.
 * Antes ele listava os 200 pedidos da loja para achar um: além de caro, dava
 * à automação um endpoint que devolve muito mais do que ela precisa.
 */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { referencia } = await params;
  const p = await prisma.pedido.findUnique({
    where: { referencia },
    select: { referencia: true, numero: true, status: true, meioPagamento: true, pagamentoStatus: true, totalCentavos: true, clienteNome: true, clienteTelefone: true, atualizadoEm: true, tenant: { select: { slug: true } } },
  });
  if (!p) return Response.json({ erro: "pedido não encontrado" }, { status: 404 });
  const { tenant, ...resto } = p;
  return Response.json({ ...resto, slug: tenant.slug, aguardandoPagamento: p.status === "AGUARDANDO_PAGAMENTO" });
}
