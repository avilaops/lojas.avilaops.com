import type { Pedido, PedidoStatus, Prisma, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { urlDaLoja } from "./tenant";

export const STATUS_QUE_A_LOJA_MUDA = ["EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"] as const;
export type StatusDaLoja = (typeof STATUS_QUE_A_LOJA_MUDA)[number];
export type AtorPedido = { tipo: "DONO" | "GERENTE" | "OPERADOR" | "API" | "CANAL" | "SISTEMA"; id?: string | null; email?: string | null };

const TRANSICOES: Record<PedidoStatus, readonly PedidoStatus[]> = {
  COTADO: ["APROVADO", "CANCELADO"],
  APROVADO: ["AGUARDANDO_PAGAMENTO", "CANCELADO"],
  AGUARDANDO_PAGAMENTO: ["PAGO", "CANCELADO"],
  PAGO: ["EM_SEPARACAO", "CANCELADO", "ESTORNADO"],
  EM_SEPARACAO: ["ENVIADO", "CANCELADO", "ESTORNADO"],
  ENVIADO: ["ENTREGUE", "CANCELADO", "ESTORNADO"],
  ENTREGUE: ["ESTORNADO"], CANCELADO: [], ESTORNADO: [],
};

export function transicaoPermitida(de: PedidoStatus, para: PedidoStatus): boolean {
  return de === para || TRANSICOES[de].includes(para);
}

export class MudancaDeStatusRecusada extends Error {
  constructor(public motivo: "nao_encontrado" | "nao_pago" | "transicao_invalida" | "quantidade_invalida", mensagem: string) {
    super(mensagem); this.name = "MudancaDeStatusRecusada";
  }
}

export interface MudancaDeStatus {
  status?: StatusDaLoja;
  rastreio?: string | null;
  idempotencia?: string;
  origem?: string;
  ator?: AtorPedido;
}

export type ProgressoItemPedido = { id: string; quantidadePaga?: number; quantidadeExpedida?: number; quantidadeCancelada?: number; quantidadeDevolvida?: number };

async function transacaoSerializavel<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      return await prisma.$transaction(executar, { isolationLevel: "Serializable" });
    } catch (erro) {
      const codigo = typeof erro === "object" && erro !== null && "code" in erro ? String(erro.code) : null;
      if (codigo !== "P2034" || tentativa === 5) throw erro;
      await new Promise((resolver) => setTimeout(resolver, tentativa * 15));
    }
  }
  throw new Error("Falha inesperada ao concluir a transação do pedido.");
}

function conferirQuantidade(nome: string, valor: number | undefined, total: number) {
  if (valor !== undefined && (!Number.isSafeInteger(valor) || valor < 0 || valor > total)) {
    throw new MudancaDeStatusRecusada("quantidade_invalida", `${nome} deve ficar entre zero e a quantidade do item.`);
  }
}

export async function atualizarProgressoDosItens(loja: Tenant, pedidoId: string, itens: ProgressoItemPedido[], opcoes: { ator: AtorPedido; origem: string; idempotencia: string }) {
  return transacaoSerializavel(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Pedido" WHERE id=${pedidoId} AND "tenantId"=${loja.id} FOR UPDATE`;
    const pedido = await tx.pedido.findFirst({ where: { id: pedidoId, tenantId: loja.id }, include: { itens: true } });
    if (!pedido) throw new MudancaDeStatusRecusada("nao_encontrado", "Pedido não encontrado nesta loja.");
    const idempotencia = `pedido:${pedido.id}:${opcoes.idempotencia}`;
    const repetido = await tx.eventoPedido.findUnique({ where: { tenantId_idempotencia: { tenantId: loja.id, idempotencia } } });
    if (repetido) return pedido;
    for (const entrada of itens) {
      const atual = pedido.itens.find((item) => item.id === entrada.id);
      if (!atual) throw new MudancaDeStatusRecusada("nao_encontrado", "Item não encontrado neste pedido.");
      conferirQuantidade("Quantidade paga", entrada.quantidadePaga, atual.quantidade);
      conferirQuantidade("Quantidade expedida", entrada.quantidadeExpedida, atual.quantidade);
      conferirQuantidade("Quantidade cancelada", entrada.quantidadeCancelada, atual.quantidade);
      conferirQuantidade("Quantidade devolvida", entrada.quantidadeDevolvida, atual.quantidade);
      const expedida = entrada.quantidadeExpedida ?? atual.quantidadeExpedida;
      const cancelada = entrada.quantidadeCancelada ?? atual.quantidadeCancelada;
      const devolvida = entrada.quantidadeDevolvida ?? atual.quantidadeDevolvida;
      if (expedida + cancelada > atual.quantidade || devolvida > expedida) throw new MudancaDeStatusRecusada("quantidade_invalida", "Expedido e cancelado não podem superar o item; devolvido não pode superar o expedido.");
      await tx.pedidoItem.update({ where: { id: atual.id }, data: entrada });
    }
    await tx.eventoPedido.create({ data: { tenantId: loja.id, pedidoId: pedido.id, tipo: "ITENS_ATUALIZADOS", atorTipo: opcoes.ator.tipo, atorId: opcoes.ator.id ?? null, atorEmail: opcoes.ator.email ?? null, origem: opcoes.origem, idempotencia, dados: itens as unknown as Prisma.InputJsonValue } });
    return tx.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: { itens: true } });
  });
}

export async function mudarStatusDoPedido(loja: Tenant, idOuReferencia: string, mudanca: MudancaDeStatus): Promise<{ pedido: Pedido; mudou: boolean }> {
  const ator = mudanca.ator ?? { tipo: "SISTEMA" as const };
  const origem = mudanca.origem ?? "interno";
  const resultado = await transacaoSerializavel(async (tx) => {
    const encontrado = await tx.pedido.findFirst({ where: { tenantId: loja.id, OR: [{ id: idOuReferencia }, { referencia: idOuReferencia }] } });
    if (!encontrado) throw new MudancaDeStatusRecusada("nao_encontrado", "Pedido não encontrado nesta loja.");
    await tx.$queryRaw`SELECT id FROM "Pedido" WHERE id=${encontrado.id} AND "tenantId"=${loja.id} FOR UPDATE`;
    const pedido = await tx.pedido.findFirstOrThrow({ where: { id: encontrado.id, tenantId: loja.id } });
    const idempotencia = mudanca.idempotencia
      ? `pedido:${pedido.id}:${mudanca.idempotencia}`
      : `pedido:${pedido.id}:${mudanca.status ?? "rastreio"}:${mudanca.rastreio ?? ""}`;
    const repetido = await tx.eventoPedido.findUnique({ where: { tenantId_idempotencia: { tenantId: loja.id, idempotencia } } });
    if (repetido) return { pedido, mudou: false };
    if (mudanca.status && !transicaoPermitida(pedido.status, mudanca.status)) {
      throw new MudancaDeStatusRecusada(pedido.status === "AGUARDANDO_PAGAMENTO" ? "nao_pago" : "transicao_invalida", `Transição inválida: ${pedido.status} → ${mudanca.status}.`);
    }
    const mudou = Boolean(mudanca.status && mudanca.status !== pedido.status);
    const atualizado = await tx.pedido.update({ where: { id: pedido.id }, data: { ...(mudanca.status ? { status: mudanca.status } : {}), ...(mudanca.rastreio !== undefined ? { rastreio: mudanca.rastreio || null } : {}) } });
    const itens = mudanca.status === "ENVIADO" || mudanca.status === "CANCELADO" ? await tx.pedidoItem.findMany({ where: { pedidoId: pedido.id } }) : [];
    for (const item of itens) await tx.pedidoItem.update({ where: { id: item.id }, data: mudanca.status === "ENVIADO" ? { quantidadeExpedida: item.quantidade - item.quantidadeCancelada } : { quantidadeCancelada: item.quantidade - item.quantidadeExpedida } });
    await tx.eventoPedido.create({ data: { tenantId: loja.id, pedidoId: pedido.id, tipo: mudou ? "STATUS_ALTERADO" : "RASTREIO_ATUALIZADO", deStatus: pedido.status, paraStatus: mudanca.status ?? pedido.status, atorTipo: ator.tipo, atorId: ator.id ?? null, atorEmail: ator.email ?? null, origem, idempotencia, dados: { rastreio: mudanca.rastreio ?? atualizado.rastreio } as Prisma.InputJsonValue } });
    return { pedido: atualizado, mudou };
  });
  if (!resultado.mudou || !mudanca.status) return resultado;
  const a = resultado.pedido;
  const comum = { slug: loja.slug, referencia: a.referencia, numero: a.numero, clienteNome: a.clienteNome, clienteEmail: a.clienteEmail, clienteTelefone: a.clienteTelefone, linkPedido: `${urlDaLoja(loja)}/pedido/${a.referencia}`, lojaNome: loja.nome, lojaUrl: urlDaLoja(loja), lojistaEmail: loja.loginEmail ?? loja.emailContato, lojistaWhatsapp: loja.whatsapp, emailRemetente: loja.emailRemetente };
  if (mudanca.status === "EM_SEPARACAO") await emitir({ tipo: "pedido.em-separacao", ...comum }, { chave: `em-separacao:${a.referencia}` });
  if (mudanca.status === "ENVIADO") await emitir({ tipo: "pedido.enviado", transportadora: a.freteNome, rastreio: a.rastreio, ...comum }, { chave: `enviado:${a.referencia}` });
  if (mudanca.status === "ENTREGUE") await emitir({ tipo: "pedido.entregue", ...comum }, { chave: `entregue:${a.referencia}` });
  if (mudanca.status === "CANCELADO") await emitir({ tipo: "pedido.cancelado", totalCentavos: a.totalCentavos, motivo: "cancelado pela loja", ...comum }, { chave: `cancelado:${a.referencia}` });
  return resultado;
}
