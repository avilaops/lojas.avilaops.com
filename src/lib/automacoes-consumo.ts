import { prisma } from "./db";
import { acoesDoEvento, tiposQueExecutamos, type Canal } from "./acoes-do-evento";
import { enviarEmail } from "./email";
import { DadosInsuficientes } from "./emails-do-evento";
import { enviarWhatsapp } from "./whatsapp";

/**
 * O consumidor da fila de eventos — a parte que o n8n fazia.
 *
 * `AutomacaoEvento` sempre foi uma caixa de saída: a plataforma grava o evento
 * e alguém do lado de fora reivindica, executa e encerra. Esse alguém era o
 * n8n. Aqui a plataforma reivindica e executa os próprios eventos, pela mesma
 * porta e com a mesma trava — o `UPDATE … WHERE status = 'EMITIDO'` que já
 * impedia duas entregas do webhook de agirem as duas.
 *
 * **Só os tipos cujos canais este ambiente consegue cumprir inteiros**
 * (`tiposQueExecutamos`). Faltando o token do WhatsApp, `pedido.pago` volta
 * inteiro para o n8n: executar metade faria o aviso do lojista sumir sem
 * ninguém notar.
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

export async function processarEventosProprios(opcoes: { limite?: number; eventId?: string } = {}): Promise<ResumoConsumo> {
  const resumo: ResumoConsumo = { lidos: 0, processados: 0, ignorados: 0, falhas: 0, detalhes: [] };
  const nossos = tiposQueExecutamos();
  // Sem canal nenhum configurado a função não reivindica nada: melhor a fila
  // parada e visível do que evento marcado como feito sem nada ter saído.
  if (!nossos.length) return resumo;

  const limite = Math.min(Math.max(opcoes.limite ?? 50, 1), 200);
  const travaVencida = new Date(Date.now() - TRAVA_MS);
  const pendentes = await prisma.automacaoEvento.findMany({
    where: {
      ...(opcoes.eventId ? { eventId: opcoes.eventId } : {}),
      tipo: { in: nossos },
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
    const meu = await prisma.automacaoEvento.updateMany({
      where: {
        eventId: evento.eventId,
        OR: [{ status: "EMITIDO" }, { status: "PROCESSANDO", reivindicadoEm: { lt: travaVencida } }],
      },
      data: { status: "PROCESSANDO", reivindicadoEm: new Date() },
    });
    if (!meu.count) continue;

    const resultado = await cumprir(evento.eventId, evento.tipo, evento.payload, evento.canaisFeitos);
    resumo[resultado.contador]++;
    resumo.detalhes.push({ eventId: evento.eventId, tipo: evento.tipo, resultado: resultado.detalhe });
  }

  return resumo;
}

type Contador = "processados" | "ignorados" | "falhas";

/**
 * Cumpre os canais que faltam deste evento e fecha o ciclo.
 *
 * Canal que já saiu numa tentativa anterior não sai de novo: quem recebeu o
 * e-mail não recebe duas vezes porque o WhatsApp falhou depois.
 */
async function cumprir(
  eventId: string,
  tipo: string,
  payload: unknown,
  jaFeitos: string[],
): Promise<{ contador: Contador; detalhe: string }> {
  let acoes;
  try {
    acoes = acoesDoEvento({ ...((payload ?? {}) as Record<string, unknown>), tipo });
  } catch (erro) {
    // `DadosInsuficientes`: o evento promete campos que não tem. É defeito
    // nosso, não indisponibilidade de fora — fica FALHOU com o campo no texto.
    const motivo = erro instanceof Error ? erro.message : "falha inesperada";
    await encerrar(eventId, "FALHOU", motivo, jaFeitos);
    return { contador: "falhas", detalhe: `${erro instanceof DadosInsuficientes ? "dados" : "erro"}: ${motivo}` };
  }

  const pendentes: Array<{ canal: Canal; executar: () => Promise<string> }> = [];
  if (acoes.email && !jaFeitos.includes("email")) {
    const email = acoes.email;
    pendentes.push({ canal: "email", executar: async () => `e-mail para ${email.para} (${(await enviarEmail(email)).messageId})` });
  }
  if (acoes.whatsapp && !jaFeitos.includes("whatsapp")) {
    const zap = acoes.whatsapp;
    pendentes.push({ canal: "whatsapp", executar: async () => `WhatsApp ${zap.template} para ${zap.para} (${(await enviarWhatsapp(zap)).messageId})` });
  }

  if (!pendentes.length) {
    const nada = !acoes.email && !acoes.whatsapp;
    const detalhe = nada ? motivoDeIgnorar(tipo, payload) : `nada a fazer: ${jaFeitos.join(", ")} já saíram`;
    await encerrar(eventId, nada ? "IGNORADO" : "PROCESSADO", detalhe, jaFeitos);
    return { contador: nada ? "ignorados" : "processados", detalhe };
  }

  const feitos = [...jaFeitos];
  const saiu: string[] = [];
  let falha: string | null = null;
  for (const { canal, executar } of pendentes) {
    try {
      saiu.push(await executar());
      feitos.push(canal);
    } catch (erro) {
      falha = `${canal}: ${erro instanceof Error ? erro.message : "falha inesperada"}`;
      // Os outros canais ainda são tentados: WhatsApp fora do ar não pode
      // impedir a confirmação de pedido de chegar ao comprador.
      continue;
    }
    // Gravar fora do `try` de cima, e com `catch` próprio: a mensagem já saiu,
    // e um erro de banco aqui não pode ser contado como "o canal falhou" —
    // isso faria a nova tentativa mandar de novo para quem já recebeu. Falhar
    // ao gravar é raro e o pior caso continua sendo uma repetição, mas não
    // deve ser causado por confundir os dois erros.
    try {
      await prisma.automacaoEvento.update({ where: { eventId }, data: { canaisFeitos: feitos } });
    } catch (erro) {
      console.error("[eventos] canal saiu mas não registrei", eventId, canal, erro);
    }
  }

  const detalhe = [...saiu, falha].filter(Boolean).join(" · ");
  await encerrar(eventId, falha ? "FALHOU" : "PROCESSADO", detalhe, feitos);
  return { contador: falha ? "falhas" : "processados", detalhe };
}

/** Por que este evento não vira mensagem nenhuma — a tela de automações mostra isto. */
function motivoDeIgnorar(tipo: string, payload: unknown): string {
  if (tipo.startsWith("categoria.seo")) return "evento de SEO não notifica ninguém";
  const envelope = (payload ?? {}) as Record<string, unknown>;
  const destino = ["clienteEmail", "destinatario", "emailContato", "email", "clienteTelefone", "whatsapp", "lojistaWhatsapp"].find(
    (c) => typeof envelope[c] === "string" && (envelope[c] as string).trim(),
  );
  return destino ? `destinatário inválido em ${destino}` : "sem destinatário no evento";
}

async function encerrar(
  eventId: string,
  status: "PROCESSADO" | "IGNORADO" | "FALHOU",
  detalhe: string,
  canaisFeitos: string[],
): Promise<void> {
  await prisma.automacaoEvento.update({
    where: { eventId },
    data: { status, detalhe: detalhe.slice(0, 500), concluidoEm: new Date(), canaisFeitos },
  });
}
