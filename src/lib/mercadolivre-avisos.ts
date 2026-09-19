import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl, MercadoLivreNaoConectado } from "./mercadolivre";
import { registrarPedidoMl } from "./mercadolivre-pedidos";
import { registrarPerguntaMl } from "./mercadolivre-perguntas";

/**
 * A fila de avisos do Mercado Livre, processada.
 *
 * `POST /ml/notifications` recebe e responde 200 na hora, porque o ML desliga
 * a notificação de quem demora. O que ele grava é uma linha em
 * `AutomacaoEvento` — e, até aqui, ninguém lia essa fila: o aviso de venda
 * chegava e morava no banco.
 *
 * Aqui é o outro lado. Cada aviso é reivindicado (a linha só sai de EMITIDO
 * uma vez, então duas execuções simultâneas não processam o mesmo duas
 * vezes), o recurso é relido na API do ML — o aviso diz que algo mudou, nunca
 * o que mudou — e o efeito acontece. Falha vira FALHOU com o motivo, e a linha
 * continua lá para reenviar.
 */

export interface AvisoMl {
  topico: string;
  /** O id dentro do recurso: `/orders/123` → `123`. */
  id: string;
}

export interface ResumoAvisosMl {
  lidos: number;
  pedidos: number;
  anuncios: number;
  envios: number;
  perguntas: number;
  ignorados: number;
  falhas: number;
  detalhes: Array<{ loja: string; topico: string; resultado: string }>;
}

/**
 * Lê o envelope guardado pelo webhook.
 *
 * O `resource` vem como caminho (`/orders/2000003508419013`), e o tópico ora
 * no envelope, ora só no tipo do evento (`mercadolivre.orders_v2`). Aceitar as
 * duas formas é o que permite processar o que já está na fila desde antes.
 */
export function lerAviso(tipo: string, payload: unknown): AvisoMl | null {
  const p = (payload ?? {}) as { resource?: unknown; topic?: unknown };
  const topico = String(p.topic ?? tipo.replace(/^mercadolivre\./, "")).trim();
  const recurso = String(p.resource ?? "").trim();
  if (!topico || !recurso) return null;
  const id = recurso.split("/").filter(Boolean).pop() ?? "";
  return id ? { topico, id } : null;
}

/** Anúncio pausado, encerrado ou sob revisão pelo ML volta como pendência da loja. */
async function atualizarAnuncio(loja: Tenant, mlbId: string, resumo: ResumoAvisosMl) {
  const anuncio = await prisma.anuncioMercadoLivre.findFirst({ where: { tenantId: loja.id, mlbId }, select: { id: true } });
  if (!anuncio) {
    resumo.ignorados++;
    resumo.detalhes.push({ loja: loja.slug, topico: "items", resultado: `O anúncio ${mlbId} não é desta loja.` });
    return;
  }
  const item = await chamarMl<{ status?: string; permalink?: string; sub_status?: string[] }>(loja, `/items/${encodeURIComponent(mlbId)}`);
  const encerrado = item.status === "closed";
  const pausado = item.status === "paused" || item.status === "under_review";
  await prisma.anuncioMercadoLivre.update({
    where: { id: anuncio.id },
    data: {
      statusMl: item.status ?? null,
      permalink: item.permalink ?? undefined,
      // Só o estado do ML muda aqui; o veredito do preparo continua sendo nosso.
      estado: encerrado || pausado ? "pausado" : "publicado",
      motivoErro: item.sub_status?.length ? `Mercado Livre: ${item.sub_status.join(", ")}` : null,
      sincronizadoEm: new Date(),
    },
  });
  resumo.anuncios++;
}

/**
 * Rastreio do Mercado Envios no pedido.
 *
 * O envio é dono do código e do estado da entrega; o pedido só reflete. Não
 * inventamos "entregue" a partir de etiqueta emitida: só `delivered` fecha.
 */
async function atualizarEnvio(loja: Tenant, envioId: string, resumo: ResumoAvisosMl) {
  const envio = await chamarMl<{ order_id?: number | string; tracking_number?: string | null; status?: string }>(loja, `/shipments/${encodeURIComponent(envioId)}`);
  if (!envio.order_id) {
    resumo.ignorados++;
    return;
  }
  const pedido = await prisma.pedido.findUnique({
    where: { tenantId_canal_canalPedidoId: { tenantId: loja.id, canal: "mercadolivre", canalPedidoId: String(envio.order_id) } },
    select: { id: true, status: true },
  });
  if (!pedido) {
    resumo.ignorados++;
    resumo.detalhes.push({ loja: loja.slug, topico: "shipments", resultado: `Envio de um pedido que ainda não chegou aqui (${envio.order_id}).` });
    return;
  }
  // O aviso de envio chega fora de ordem: o ML reenvia, e um "shipped" antigo
  // pode chegar depois do "delivered". Entrega e cancelamento são estados
  // finais — nenhum aviso de envio os desfaz.
  const finalizado = pedido.status === "ENTREGUE" || pedido.status === "CANCELADO" || pedido.status === "ESTORNADO";
  const status = finalizado ? pedido.status : envio.status === "delivered" ? "ENTREGUE" : envio.status === "shipped" ? "ENVIADO" : pedido.status;
  await prisma.pedido.update({
    where: { id: pedido.id },
    data: { rastreio: envio.tracking_number ?? undefined, status },
  });
  resumo.envios++;
}

/** Processa a fila. Rotina `mercadolivre.avisos`, a cada 5 min. */
export async function processarAvisosMl(opcoes: { limite?: number } = {}): Promise<ResumoAvisosMl> {
  const limite = Math.min(Math.max(opcoes.limite ?? 50, 1), 200);
  const pendentes = await prisma.automacaoEvento.findMany({
    where: { tipo: { startsWith: "mercadolivre." }, status: "EMITIDO" },
    orderBy: { emitidoEm: "asc" },
    take: limite,
  });
  const resumo: ResumoAvisosMl = { lidos: 0, pedidos: 0, anuncios: 0, envios: 0, perguntas: 0, ignorados: 0, falhas: 0, detalhes: [] };

  for (const evento of pendentes) {
    // Reivindicar antes de agir: duas execuções simultâneas não podem baixar
    // o mesmo estoque duas vezes. Quem perder a corrida não vê a linha.
    const meu = await prisma.automacaoEvento.updateMany({
      where: { eventId: evento.eventId, status: "EMITIDO" },
      data: { status: "PROCESSANDO", reivindicadoEm: new Date(), tentativas: { increment: 1 } },
    });
    if (!meu.count) continue;
    resumo.lidos++;

    const aviso = lerAviso(evento.tipo, evento.payload);
    const loja = await prisma.tenant.findUnique({ where: { slug: evento.slug } });

    try {
      if (!aviso) throw new Error("Aviso sem recurso: nada a buscar no Mercado Livre.");
      if (!loja) throw new Error(`A loja ${evento.slug} não existe mais.`);

      // O que a venda deixou por resolver acompanha o evento até o painel. O
      // resumo da rotina não serve para isso: ele volta para quem a chamou (o
      // n8n) e some. Quem precisa ler "o estoque não foi baixado porque não
      // reconheci a variação" é o lojista, e o lugar dele é Automações.
      let porResolver = "";

      if (aviso.topico === "orders_v2" || aviso.topico === "orders") {
        const r = await registrarPedidoMl(loja, aviso.id);
        resumo.pedidos++;
        if (r.avisos.length) {
          porResolver = r.avisos.join(" ");
          resumo.detalhes.push({ loja: loja.slug, topico: aviso.topico, resultado: porResolver });
        }
      } else if (aviso.topico === "items") {
        await atualizarAnuncio(loja, aviso.id, resumo);
      } else if (aviso.topico === "shipments") {
        await atualizarEnvio(loja, aviso.id, resumo);
      } else if (aviso.topico === "questions") {
        const r = await registrarPerguntaMl(loja, aviso.id);
        resumo.perguntas++;
        if (r.nova) resumo.detalhes.push({ loja: loja.slug, topico: "questions", resultado: "pergunta nova aguardando resposta" });
      } else {
        // Tópico que a plataforma ainda não trata (mensagens do pós-venda,
        // reclamações). IGNORADO é honesto: ninguém vai agir sobre ele.
        await prisma.automacaoEvento.update({
          where: { eventId: evento.eventId },
          data: { status: "IGNORADO", detalhe: `Tópico ${aviso.topico} ainda não tem tratamento.`, concluidoEm: new Date() },
        });
        resumo.ignorados++;
        continue;
      }

      await prisma.automacaoEvento.update({
        where: { eventId: evento.eventId },
        data: {
          status: "PROCESSADO",
          // Processado com ressalva continua sendo processado: a venda entrou.
          // Apagar o detalhe aqui era jogar fora justamente o que o lojista
          // precisa agir em cima.
          detalhe: porResolver ? porResolver.slice(0, 1000) : null,
          concluidoEm: new Date(),
        },
      });
    } catch (erro) {
      const mensagem = (erro instanceof MercadoLivreNaoConectado || erro instanceof Error ? erro.message : "Falha desconhecida.").slice(0, 1000);
      await prisma.automacaoEvento.update({
        where: { eventId: evento.eventId },
        data: { status: "FALHOU", detalhe: mensagem, concluidoEm: new Date() },
      });
      resumo.falhas++;
      resumo.detalhes.push({ loja: evento.slug, topico: aviso?.topico ?? evento.tipo, resultado: mensagem });
    }
  }

  return resumo;
}
