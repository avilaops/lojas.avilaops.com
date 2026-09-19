import { prisma } from "./db";
import { emailConfigurado, enviarEmail } from "./email";
import { DadosInsuficientes, emailDoEvento, temEmailProprio, TIPOS_COM_EMAIL_PROPRIO } from "./emails-do-evento";

/**
 * O consumidor da fila de eventos — a parte que o n8n fazia.
 *
 * `AutomacaoEvento` sempre foi uma caixa de saída: a plataforma grava o evento
 * e alguém do lado de fora reivindica, executa e encerra. Esse alguém era o
 * n8n. Aqui a plataforma passa a reivindicar e executar os próprios eventos,
 * pela mesma porta e com a mesma trava — o `UPDATE … WHERE status = 'EMITIDO'`
 * que já impedia duas entregas do webhook de agirem as duas.
 *
 * **Só os tipos cujo efeito inteiro é um e-mail.** Evento que também manda
 * WhatsApp continua indo para o n8n inteiro: trazer metade para cá faria o
 * aviso do lojista sumir sem ninguém notar. A lista está em
 * `TIPOS_COM_EMAIL_PROPRIO`, e `emitir()` usa a mesma para decidir o caminho.
 */

export interface ResumoConsumo {
  lidos: number;
  processados: number;
  ignorados: number;
  falhas: number;
  detalhes: Array<{ eventId: string; tipo: string; resultado: string }>;
}

/** Quanto tempo um evento pode ficar PROCESSANDO antes de ser dado por morto. */
const TRAVA_MS = 10 * 60 * 1000;

/**
 * Processa a fila dos tipos que sabemos executar.
 *
 * Sem SMTP configurado a função não reivindica nada: melhor a fila parada e
 * visível do que evento marcado como feito sem e-mail nenhum ter saído.
 */
export async function processarEventosProprios(opcoes: { limite?: number; eventId?: string } = {}): Promise<ResumoConsumo> {
  const resumo: ResumoConsumo = { lidos: 0, processados: 0, ignorados: 0, falhas: 0, detalhes: [] };
  if (!emailConfigurado()) return resumo;

  const limite = Math.min(Math.max(opcoes.limite ?? 50, 1), 200);
  const travaVencida = new Date(Date.now() - TRAVA_MS);
  const pendentes = await prisma.automacaoEvento.findMany({
    where: {
      ...(opcoes.eventId ? { eventId: opcoes.eventId } : {}),
      tipo: { in: [...TIPOS_COM_EMAIL_PROPRIO] },
      OR: [
        { status: "EMITIDO" },
        // Container que morreu no meio deixa PROCESSANDO para trás. Depois da
        // trava, o evento volta para a fila em vez de ficar preso para sempre.
        { status: "PROCESSANDO", reivindicadoEm: { lt: travaVencida } },
      ],
    },
    orderBy: { emitidoEm: "asc" },
    take: limite,
  });

  for (const evento of pendentes) {
    resumo.lidos++;
    // Reivindicar antes de qualquer efeito: se o n8n ainda estiver ligado para
    // este tipo, quem perder a corrida não vê a linha e ninguém manda dois.
    const meu = await prisma.automacaoEvento.updateMany({
      where: {
        eventId: evento.eventId,
        OR: [{ status: "EMITIDO" }, { status: "PROCESSANDO", reivindicadoEm: { lt: travaVencida } }],
      },
      data: { status: "PROCESSANDO", reivindicadoEm: new Date() },
    });
    if (!meu.count) continue;

    try {
      const envelope = (evento.payload ?? {}) as Record<string, unknown>;
      // O tipo do banco manda: payload reenviado pode ser antigo, mas a linha
      // é a verdade sobre o que este evento é.
      const email = temEmailProprio(evento.tipo) ? emailDoEvento({ ...envelope, tipo: evento.tipo }) : null;

      if (!email) {
        await encerrar(evento.eventId, "IGNORADO", motivoDeIgnorar(evento.tipo, envelope));
        resumo.ignorados++;
        resumo.detalhes.push({ eventId: evento.eventId, tipo: evento.tipo, resultado: "ignorado" });
        continue;
      }

      const { messageId } = await enviarEmail(email);
      await encerrar(evento.eventId, "PROCESSADO", `e-mail para ${email.para} (${messageId})`);
      resumo.processados++;
      resumo.detalhes.push({ eventId: evento.eventId, tipo: evento.tipo, resultado: `e-mail para ${email.para}` });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "falha inesperada";
      // `DadosInsuficientes` é defeito nosso, não indisponibilidade de fora:
      // fica FALHOU e aparece na tela de automações com o campo que faltou.
      await encerrar(evento.eventId, "FALHOU", motivo);
      resumo.falhas++;
      resumo.detalhes.push({
        eventId: evento.eventId,
        tipo: evento.tipo,
        resultado: `${erro instanceof DadosInsuficientes ? "dados" : "envio"}: ${motivo}`,
      });
    }
  }

  return resumo;
}

/** Por que este evento não vira e-mail — a tela de automações mostra isto. */
function motivoDeIgnorar(tipo: string, envelope: Record<string, unknown>): string {
  if (tipo.startsWith("categoria.seo")) return "evento de SEO não notifica ninguém";
  const destino = ["clienteEmail", "destinatario", "emailContato", "email"].find(
    (c) => typeof envelope[c] === "string" && (envelope[c] as string).trim(),
  );
  return destino ? `destinatário inválido em ${destino}` : "sem endereço de e-mail no evento";
}

async function encerrar(eventId: string, status: "PROCESSADO" | "IGNORADO" | "FALHOU", detalhe: string): Promise<void> {
  await prisma.automacaoEvento.update({
    where: { eventId },
    data: { status, detalhe: detalhe.slice(0, 500), concluidoEm: new Date() },
  });
}
