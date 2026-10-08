import { lookup } from "node:dns/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { pedidoDaApi } from "./api-recursos";
import { decifrar } from "./cofre";
import {
  FALHAS_ATE_DESLIGAR,
  TENTATIVAS_MAXIMAS,
  assinar,
  enderecoPrivado,
  entregou,
  motivoDaRecusa,
  proximaTentativa,
  type EventoDeWebhook,
} from "./webhooks-api";

/**
 * A fila e o envio dos webhooks para o desenvolvedor.
 *
 * Enfileirar é barato e acontece junto do evento (`emitir`, em eventos.ts);
 * enviar é da rotina `webhooks.entregar`, de minuto em minuto. O checkout não
 * espera o servidor de ninguém responder.
 */

/** O que o receptor recebe. `id` é o do evento: o mesmo fato chega sempre com o mesmo id. */
export interface CorpoDoWebhook {
  id: string;
  tipo: EventoDeWebhook;
  criadoEm: string;
  dados: { pedido: ReturnType<typeof pedidoDaApi> };
}

/**
 * Põe na fila uma entrega para cada webhook da loja inscrito no evento.
 *
 * O corpo é montado agora, com o pedido como está neste instante, pela mesma
 * projeção da API (`pedidoDaApi`): o que o webhook manda é o que
 * `GET /api/v1/pedidos/{id}` devolveria. Nada do envelope interno do evento
 * (que carrega e-mail e WhatsApp do lojista) vai junto.
 *
 * Nunca lança: avisar um sistema de fora não pode derrubar a venda. A chave
 * única (`webhookId`, `eventId`) faz a segunda chamada para o mesmo evento não
 * criar nada.
 */
export async function enfileirarWebhooks(slug: string, tipo: EventoDeWebhook, eventId: string, referencia: string): Promise<number> {
  try {
    const webhooks = await prisma.webhookApi.findMany({
      where: { tenant: { slug }, ativo: true, eventos: { has: tipo } },
      select: { id: true, tenantId: true },
    });
    if (webhooks.length === 0) return 0;

    const pedido = await prisma.pedido.findFirst({
      where: { tenantId: webhooks[0].tenantId, referencia },
      include: { itens: true, postagem: { select: { codigoObjeto: true } } },
    });
    if (!pedido) return 0;

    const corpo: CorpoDoWebhook = { id: eventId, tipo, criadoEm: new Date().toISOString(), dados: { pedido: pedidoDaApi(pedido) } };
    const r = await prisma.entregaWebhook.createMany({
      data: webhooks.map((w) => ({ webhookId: w.id, tenantId: w.tenantId, eventId, tipo, corpo: corpo as unknown as Prisma.InputJsonValue })),
      skipDuplicates: true,
    });
    return r.count;
  } catch (erro) {
    console.error("[webhooks] não enfileirou", tipo, eventId, erro instanceof Error ? erro.message : erro);
    return 0;
  }
}

export interface RespostaDoDestino {
  status: number;
}

export type Enviar = (url: string, corpo: string, cabecalhos: Record<string, string>) => Promise<RespostaDoDestino>;

/**
 * O envio de verdade.
 *
 * O nome é resolvido antes e recusado se apontar para dentro: o endereço foi
 * conferido no cadastro, mas DNS muda depois, e é assim que se aponta um
 * domínio "público" para `169.254.169.254`. Redirecionamento não é seguido
 * pelo mesmo motivo — o destino do salto não passou por conferência nenhuma.
 */
export const enviarPorHttp: Enviar = async (url, corpo, cabecalhos) => {
  const recusa = motivoDaRecusa(url);
  if (recusa) throw new Error(recusa);
  const enderecos = await lookup(new URL(url).hostname, { all: true });
  if (enderecos.length === 0 || enderecos.some((e) => enderecoPrivado(e.address))) {
    throw new Error("O endereço resolve para uma rede interna.");
  }
  const r = await fetch(url, { method: "POST", headers: cabecalhos, body: corpo, redirect: "manual", signal: AbortSignal.timeout(8000) });
  // O corpo da resposta não interessa; soltar a conexão sem ler.
  await r.body?.cancel().catch(() => {});
  return { status: r.status };
};

/** Entrega que ficou "enviando" por mais que isto é de um processo que morreu no meio. */
const TRAVA_MS = 5 * 60_000;
/** Entrega encerrada some depois disto; a tela mostra as últimas, não o arquivo. */
export const RETENCAO_DIAS = 30;

export interface ResumoDaEntrega {
  entregues: number;
  adiadas: number;
  esgotadas: number;
  desligados: number;
}

/**
 * Uma passada da fila: pega o que venceu, envia, anota.
 *
 * Cada entrega é reivindicada com escrita condicional antes do envio, então
 * duas passadas ao mesmo tempo não mandam a mesma duas vezes. Ainda assim o
 * contrato com quem recebe é "pelo menos uma vez": se o destino responder 200 e
 * a nossa anotação falhar, ele recebe de novo — com o mesmo `id`, que é como
 * ele reconhece a repetição.
 */
export async function entregarWebhooks(opcoes: { limite?: number; enviar?: Enviar; agora?: Date } = {}): Promise<ResumoDaEntrega> {
  const enviar = opcoes.enviar ?? enviarPorHttp;
  const agora = opcoes.agora ?? new Date();
  const resumo: ResumoDaEntrega = { entregues: 0, adiadas: 0, esgotadas: 0, desligados: 0 };

  await prisma.entregaWebhook.deleteMany({
    where: { status: { in: ["ENTREGUE", "FALHOU"] }, criadaEm: { lt: new Date(agora.getTime() - RETENCAO_DIAS * 86_400_000) } },
  });

  const vencidas = await prisma.entregaWebhook.findMany({
    where: {
      OR: [
        { status: "PENDENTE", proximaEm: { lte: agora } },
        { status: "ENVIANDO", enviandoDesde: { lt: new Date(agora.getTime() - TRAVA_MS) } },
      ],
      webhook: { ativo: true },
    },
    orderBy: { proximaEm: "asc" },
    take: opcoes.limite ?? 50,
    include: { webhook: { select: { id: true, url: true, segredoEnc: true } } },
  });

  for (const e of vencidas) {
    const minha = await prisma.entregaWebhook.updateMany({
      where: { id: e.id, status: e.status, tentativas: e.tentativas },
      data: { status: "ENVIANDO", enviandoDesde: new Date(), tentativas: { increment: 1 } },
    });
    if (minha.count !== 1) continue;
    const tentativas = e.tentativas + 1;

    let status: number | null = null;
    let erro: string | null = null;
    try {
      const corpo = JSON.stringify(e.corpo);
      const r = await enviar(e.webhook.url, corpo, {
        "content-type": "application/json",
        "user-agent": "Lojas-Avila-Ops-Webhooks/1",
        "x-lojas-evento": e.tipo,
        "x-lojas-entrega": e.id,
        "x-lojas-assinatura": assinar(decifrar(e.webhook.segredoEnc), corpo),
      });
      status = r.status;
      if (!entregou(status)) erro = `o destino respondeu ${status}`;
    } catch (falha) {
      // Só a mensagem, e curta: é o que o lojista lê na tela para consertar o lado dele.
      erro = (falha instanceof Error ? falha.message : String(falha)).slice(0, 200);
    }

    if (!erro) {
      await prisma.entregaWebhook.update({ where: { id: e.id }, data: { status: "ENTREGUE", entregueEm: new Date(), ultimoStatus: status, ultimoErro: null, enviandoDesde: null } });
      await prisma.webhookApi.update({ where: { id: e.webhook.id }, data: { falhasSeguidas: 0, ultimaEntregaEm: new Date() } });
      resumo.entregues++;
      continue;
    }

    const proxima = tentativas >= TENTATIVAS_MAXIMAS ? null : proximaTentativa(tentativas, agora);
    await prisma.entregaWebhook.update({
      where: { id: e.id },
      data: { status: proxima ? "PENDENTE" : "FALHOU", proximaEm: proxima ?? agora, ultimoStatus: status, ultimoErro: erro, enviandoDesde: null },
    });
    if (proxima) {
      resumo.adiadas++;
      continue;
    }
    resumo.esgotadas++;
    // Endereço que esgota entrega atrás de entrega está morto. Desligar poupa o
    // destino e a nossa fila; o lojista vê o motivo no painel e religa.
    const w = await prisma.webhookApi.update({ where: { id: e.webhook.id }, data: { falhasSeguidas: { increment: 1 } }, select: { falhasSeguidas: true } });
    if (w.falhasSeguidas >= FALHAS_ATE_DESLIGAR) {
      const desligou = await prisma.webhookApi.updateMany({
        where: { id: e.webhook.id, ativo: true },
        data: { ativo: false, desligadoEm: new Date(), desligadoMotivo: `${FALHAS_ATE_DESLIGAR} entregas seguidas sem resposta. Último erro: ${erro}` },
      });
      resumo.desligados += desligou.count;
    }
  }
  return resumo;
}
