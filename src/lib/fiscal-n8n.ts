import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { cifrar, decifrar } from "./cofre";
import { conferirAssinatura, gerarSegredoDeWebhook } from "./webhooks-api";
import { enfileirarFluxosFiscais } from "./fiscal-fluxos";
import { EVENTOS_FISCAIS, CAMPOS_FISCAIS } from "./fiscal-fluxos-contrato";

export const DESTINO_FISCAL_N8N = "https://n8n.avilaops.com/webhook/lojas-fiscal";
export const ReceberFiscalN8n = z.object({
  entregaId: z.string().min(1).max(80),
  eventId: z.string().min(8).max(80),
  tenantId: z.string().min(1).max(80),
  assinatura: z.string().min(1).max(200),
  execucaoId: z.string().regex(/^\d{1,30}$/),
}).strict();
const CorpoFiscal = z.object({
  id: z.string(), tenantId: z.string(), tipo: z.enum(["fiscal.nfe-resumo", "fiscal.nfe-recebida", "fiscal.evento-recebido"]), versao: z.literal(1),
  correlationId: z.string(), fluxo: z.object({ id: z.string(), finalidade: z.string() }),
  controle: z.object({ modo: z.literal("REVISAO"), exigeConfirmacaoFinanceira: z.literal(true), exigeConfirmacaoEstoque: z.literal(true), exigeConfirmacaoProdutos: z.literal(true) }),
  dados: z.object({ documento: z.object({ id: z.string() }) }).passthrough(),
});
export class ErroRecepcaoFiscal extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** O n8n devolve somente IDs e assinatura. O conteúdo autorizado é sempre relido da fila. */
export async function receberFiscalNoN8n(entrada: z.infer<typeof ReceberFiscalN8n>, agoraMs = Date.now()) {
  const entrega = await prisma.entregaWebhook.findFirst({
    where: { id: entrada.entregaId, eventId: entrada.eventId, tenantId: entrada.tenantId, tipo: { startsWith: "fiscal." }, webhook: { ativo: true, url: DESTINO_FISCAL_N8N, tenantId: entrada.tenantId, tenant: { status: "ATIVA", plano: "LOJA_PRO" } } },
    include: { webhook: { select: { segredoEnc: true, tenant: { select: { slug: true } } } } },
  });
  if (!entrega) throw new ErroRecepcaoFiscal("Entrega fiscal não encontrada ou destino indisponível.", 404);
  // JSONB é a mesma fonte usada por entregarWebhooks ao produzir o corpo assinado.
  if (!conferirAssinatura(decifrar(entrega.webhook.segredoEnc), JSON.stringify(entrega.corpo), entrada.assinatura, agoraMs)) throw new ErroRecepcaoFiscal("Assinatura fiscal inválida ou expirada.", 403);
  const r = CorpoFiscal.safeParse(entrega.corpo);
  if (!r.success || r.data.id !== entrada.eventId || r.data.tenantId !== entrada.tenantId || r.data.tipo !== entrega.tipo) throw new ErroRecepcaoFiscal("Contrato fiscal inválido.", 422);
  const corpo = r.data;
  const [documento, fluxo] = await Promise.all([
    prisma.documentoFiscalLoja.findFirst({ where: { id: corpo.dados.documento.id, tenantId: entrada.tenantId }, select: { id: true } }),
    prisma.fluxoFiscalLoja.findFirst({ where: { id: corpo.fluxo.id, tenantId: entrada.tenantId, webhookId: entrega.webhookId }, select: { id: true } }),
  ]);
  if (!documento || !fluxo) throw new ErroRecepcaoFiscal("Documento ou fluxo fora do escopo da entrega.", 422);
  const registro = await prisma.automacaoEvento.createMany({
    data: [{ eventId: corpo.id, slug: entrega.webhook.tenant.slug, tipo: corpo.tipo, status: "PROCESSADO", versao: 1,
      correlationId: corpo.correlationId, concluidoEm: new Date(agoraMs), detalhe: `n8n execução ${entrada.execucaoId}: recebido para revisão; sem movimentação operacional`,
      payload: { tenantId: entrada.tenantId, documentoId: documento.id, fluxoId: fluxo.id, finalidade: corpo.fluxo.finalidade, revisao: "PENDENTE", execucaoId: entrada.execucaoId,
        camposPresentes: Object.keys(corpo.dados).filter((c) => c !== "documento"), nenhumaMovimentacao: true },
    }], skipDuplicates: true,
  });
  return { ok: true, eventId: corpo.id, duplicado: registro.count === 0, revisao: "PENDENTE", nenhumaMovimentacao: true };
}

/** Configuração idempotente, apenas para lojas que já possuem o monitor fiscal. */
export async function configurarFiscalN8n(slugs?: string[]) {
  const lojas = await prisma.tenant.findMany({ where: { status: "ATIVA", plano: "LOJA_PRO", ...(slugs ? { slug: { in: slugs } } : {}), OR: [{ fiscal: { isNot: null } }, { documentosFiscais: { some: {} } }] }, select: { id: true, slug: true } });
  const resultados = [];
  for (const loja of lojas) {
    for (let tentativa = 0; ; tentativa++) {
      try {
        const resultado = await prisma.$transaction(async (tx) => {
          let destino = await tx.webhookApi.findFirst({ where: { tenantId: loja.id, url: DESTINO_FISCAL_N8N }, orderBy: { criadoEm: "asc" } });
          const destinoCriado = !destino;
          if (!destino) {
            if (await tx.webhookApi.count({ where: { tenantId: loja.id } }) >= 5) return { slug: loja.slug, configurado: false, motivo: "limite de destinos da loja" };
            destino = await tx.webhookApi.create({ data: { tenantId: loja.id, nome: "n8n · Revisão fiscal", url: DESTINO_FISCAL_N8N, eventos: [], segredoEnc: cifrar(gerarSegredoDeWebhook()) } });
          }
          const chave = { tenantId: loja.id, webhookId: destino.id, finalidade: "divergencias" };
          const existente = await tx.fluxoFiscalLoja.findUnique({ where: { tenantId_webhookId_finalidade: chave } });
          const fluxo = existente ?? await tx.fluxoFiscalLoja.create({ data: { ...chave, nome: "Entrada fiscal para revisão", eventos: Object.keys(EVENTOS_FISCAIS), campos: Object.keys(CAMPOS_FISCAIS), criadoPor: "N8N:administracao" } });
          return { slug: loja.slug, configurado: true, destinoId: destino.id, fluxoId: fluxo.id, destinoCriado, fluxoCriado: !existente, ativo: destino.ativo && fluxo.ativo };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        resultados.push(resultado); break;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && tentativa < 2)) throw e;
      }
    }
  }
  return { resultados, historicoReprocessado: false, nenhumaMovimentacao: true };
}

/** Ensaio autorizado: uma entrega histórica por loja, usando a mesma fila e a mesma trava. */
export async function testarFiscalN8n(slugs?: string[]) {
  const fluxos = await prisma.fluxoFiscalLoja.findMany({ where: { ativo: true, finalidade: "divergencias", webhook: { ativo: true, url: DESTINO_FISCAL_N8N }, tenant: { status: "ATIVA", plano: "LOJA_PRO", ...(slugs ? { slug: { in: slugs } } : {}) } }, include: { tenant: { select: { slug: true } } } });
  const resultados = [];
  for (const fluxo of fluxos) {
    const doc = await prisma.documentoFiscalLoja.findFirst({ where: { tenantId: fluxo.tenantId, schema: { startsWith: "procNFe" } }, orderBy: { recebidoEm: "desc" } })
      ?? await prisma.documentoFiscalLoja.findFirst({ where: { tenantId: fluxo.tenantId }, orderBy: { recebidoEm: "desc" } });
    const enfileirados = doc ? await prisma.$transaction((tx) => enfileirarFluxosFiscais(tx, fluxo.tenantId, [doc], { fluxoId: fluxo.id, solicitadoPor: "N8N:teste-autorizado" })) : 0;
    resultados.push({ slug: fluxo.tenant.slug, enfileirados, documentoDisponivel: !!doc });
  }
  return { resultados, nenhumaMovimentacao: true };
}
