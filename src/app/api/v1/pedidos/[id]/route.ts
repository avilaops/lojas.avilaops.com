import { z } from "zod";
import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { pedidoDaApi } from "@/lib/api-recursos";
import { ErroApi, lerCorpo } from "@/lib/api-resposta";
import { atualizarProgressoDosItens, mudarStatusDoPedido, MudancaDeStatusRecusada, STATUS_QUE_A_LOJA_MUDA } from "@/lib/pedidos-status";

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
    itens: z.array(z.object({
      id: z.string().min(1),
      quantidadePaga: z.number().int().min(0).optional(),
      quantidadeExpedida: z.number().int().min(0).optional(),
      quantidadeCancelada: z.number().int().min(0).optional(),
      quantidadeDevolvida: z.number().int().min(0).optional(),
    }).strict()).min(1).optional(),
  })
  // Campo desconhecido é erro: `situacao: "ENVIADO"`, ignorado em silêncio, é
  // o ERP achando que avisou o cliente.
  .strict()
  .refine((m) => m.status !== undefined || m.rastreio !== undefined || m.itens !== undefined, "informe status, rastreio ou itens");

export const PATCH = rotaDaApi<{ id: string }>({ escopo: "pedidos:escrever" }, async ({ request, tenant, params }) => {
  const mudanca = await lerCorpo(request, Mudanca);
  const idempotencia = request.headers.get("idempotency-key")?.trim();
  try {
    let pedidoId: string | null = null;
    let mudou = false;
    if (mudanca.itens) {
      if (!idempotencia) throw new ErroApi("parametro_invalido", "Informe o cabeçalho Idempotency-Key para alterar itens.");
      const pedido = await atualizarProgressoDosItens(tenant, params.id, mudanca.itens, {
        ator: { tipo: "API" }, origem: "api-v1", idempotencia: `${idempotencia}:itens`,
      });
      pedidoId = pedido.id;
    }
    if (mudanca.status !== undefined || mudanca.rastreio !== undefined) {
      const resultado = await mudarStatusDoPedido(tenant, params.id, {
        status: mudanca.status,
        rastreio: mudanca.rastreio,
        ator: { tipo: "API" },
        origem: "api-v1",
        idempotencia: idempotencia ? `${idempotencia}:status` : undefined,
      });
      pedidoId = resultado.pedido.id;
      mudou = resultado.mudou;
    }
    const completo = await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId! }, include: INCLUIR });
    return { dados: { ...pedidoDaApi(completo), mudou } };
  } catch (e) {
    if (!(e instanceof MudancaDeStatusRecusada)) throw e;
    throw new ErroApi(e.motivo === "nao_encontrado" ? "nao_encontrado" : "conflito", e.message);
  }
});
