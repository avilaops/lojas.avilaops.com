import { z } from "zod";
import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { pedidoDaApi } from "@/lib/api-recursos";
import { ErroApi, lerCorpo } from "@/lib/api-resposta";
import { mudarStatusDoPedido, MudancaDeStatusRecusada, STATUS_QUE_A_LOJA_MUDA } from "@/lib/pedidos-status";

/**
 * Um pedido. `{id}` aceita o id ou a referência.
 *
 * GET   — o pedido com os itens.
 * PATCH — o ERP ou a transportadora avança o pedido: separar, enviar (com
 *         rastreio), entregar, cancelar. É a mesma função do painel
 *         (`mudarStatusDoPedido`): mesma regra, mesmo aviso ao comprador.
 *
 * Reenviar a mesma mudança não faz nada de novo: o status já está lá, e o
 * aviso ao comprador sai uma vez por virada. Pagamento não muda por aqui.
 */
export const dynamic = "force-dynamic";

const INCLUIR = { itens: true, postagem: { select: { codigoObjeto: true } } } as const;

export const GET = rotaDaApi<{ id: string }>({ escopo: "pedidos:ler" }, async ({ tenant, params }) => {
  const pedido = await prisma.pedido.findFirst({
    where: { tenantId: tenant.id, OR: [{ id: params.id }, { referencia: params.id }] },
    include: INCLUIR,
  });
  if (!pedido) throw new ErroApi("nao_encontrado", "Pedido não encontrado nesta loja.");
  return { dados: pedidoDaApi(pedido) };
});

const Mudanca = z
  .object({
    status: z.enum(STATUS_QUE_A_LOJA_MUDA).optional(),
    rastreio: z.string().trim().min(1).max(60).nullable().optional(),
  })
  // Campo desconhecido é erro: `situacao: "ENVIADO"`, ignorado em silêncio, é
  // o ERP achando que avisou o cliente.
  .strict()
  .refine((m) => m.status !== undefined || m.rastreio !== undefined, "informe status ou rastreio");

export const PATCH = rotaDaApi<{ id: string }>({ escopo: "pedidos:escrever" }, async ({ request, tenant, params }) => {
  const mudanca = await lerCorpo(request, Mudanca);
  try {
    const { pedido, mudou } = await mudarStatusDoPedido(tenant, params.id, mudanca);
    const completo = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: INCLUIR });
    return { dados: { ...pedidoDaApi(completo), mudou } };
  } catch (e) {
    if (!(e instanceof MudancaDeStatusRecusada)) throw e;
    throw new ErroApi(e.motivo === "nao_encontrado" ? "nao_encontrado" : "conflito", e.message);
  }
});
