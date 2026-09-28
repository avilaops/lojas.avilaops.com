import { prisma } from "./db";
import { emitir, lojista, n8nAindaExecuta } from "./eventos";
import { executamos } from "./acoes-do-evento";
import { urlDaLoja } from "./tenant";

/**
 * Os dois avisos que não são reação a um evento — são espera.
 *
 * O lembrete de Pix sai 30 min depois do pedido; o pedido de indicações, 3
 * dias depois de a loja entrar no ar. No n8n isso era um nó de espera pendurado
 * em `pedido.criado` e em `loja.ativada`. Aqui viram varredura: a rotina olha o
 * que já está no banco e decide, o que sobrevive a reinício de container —
 * espera pendurada em execução, não.
 *
 * **As duas dormem enquanto `N8N_WEBHOOK_URL` existir.** O fluxo continua
 * recebendo `pedido.criado` e `loja.ativada` e fazendo o que sempre fez;
 * ligar os dois lados ao mesmo tempo mandaria o lembrete duas vezes, e a
 * segunda ninguém saberia de onde veio.
 */

export interface ResumoAviso {
  /** Preenchido quando a rotina não fez nada de propósito, e por quê. */
  dormindo?: string;
  candidatos: number;
  emitidos: number;
  slugs: string[];
}

/** Só depois de 30 min, e nunca mais de um dia depois: lembrete tardio irrita. */
const PIX_DEPOIS_DE_MIN = 30;
const PIX_ATE_HORAS = 24;

/** A ficha comercial combina a conversa no terceiro dia. */
const INDICACOES_DEPOIS_DE_DIAS = 3;
const INDICACOES_ATE_DIAS = 5;

function porQueDormindo(tipo: string): string | null {
  if (n8nAindaExecuta()) return "o fluxo do n8n ainda recebe o evento que dispara este aviso";
  if (!executamos(tipo)) return `nenhum canal de ${tipo} está configurado neste ambiente`;
  return null;
}

/**
 * Quem já recebeu este aviso.
 *
 * A caixa de saída é o próprio registro: um evento por pedido (ou por loja),
 * amarrado pelo `correlationId`. Não precisa de coluna nova, e o reenvio manual
 * pela tela continua funcionando como em qualquer outro evento.
 */
async function jaAvisados(tipo: string, correlationIds: string[]): Promise<Set<string>> {
  if (!correlationIds.length) return new Set();
  const existentes = await prisma.automacaoEvento.findMany({
    where: { tipo, correlationId: { in: correlationIds } },
    select: { correlationId: true },
  });
  return new Set(existentes.map((e) => e.correlationId).filter((c): c is string => Boolean(c)));
}

/** Rotina `pix.lembrete`: o Pix nasceu e não foi pago. */
export async function lembrarPixPendente(agora = new Date()): Promise<ResumoAviso> {
  const dormindo = porQueDormindo("pedido.pix-pendente");
  if (dormindo) return { dormindo, candidatos: 0, emitidos: 0, slugs: [] };

  const pedidos = await prisma.pedido.findMany({
    where: {
      status: "AGUARDANDO_PAGAMENTO",
      meioPagamento: { contains: "pix", mode: "insensitive" },
      criadoEm: {
        lte: new Date(agora.getTime() - PIX_DEPOIS_DE_MIN * 60_000),
        gte: new Date(agora.getTime() - PIX_ATE_HORAS * 3_600_000),
      },
    },
    include: { tenant: true },
    orderBy: { criadoEm: "asc" },
    take: 100,
  });

  const avisados = await jaAvisados("pedido.pix-pendente", pedidos.map((p) => `pedido:${p.referencia}`));
  const resumo: ResumoAviso = { candidatos: pedidos.length, emitidos: 0, slugs: [] };

  for (const pedido of pedidos) {
    if (avisados.has(`pedido:${pedido.referencia}`)) continue;
    await emitir({
      tipo: "pedido.pix-pendente",
      slug: pedido.tenant.slug,
      referencia: pedido.referencia,
      numero: pedido.numero ?? undefined,
      totalCentavos: pedido.totalCentavos,
      clienteNome: pedido.clienteNome,
      clienteEmail: pedido.clienteEmail,
      clienteTelefone: pedido.clienteTelefone,
      linkPedido: `${urlDaLoja(pedido.tenant)}/pedido/${encodeURIComponent(pedido.referencia)}`,
      ...lojista(pedido.tenant),
    });
    resumo.emitidos++;
    resumo.slugs.push(pedido.tenant.slug);
  }
  return resumo;
}

/**
 * Rotina `loja.indicacoes`: três dias depois de a loja entrar no ar.
 *
 * A data de entrada no ar não é coluna: é o próprio `loja.ativada`, que sai uma
 * vez só na virada PROVISIONANDO → ATIVA. A caixa de saída serve de registro, e
 * assim a regra "conta a partir de quando a loja ficou no ar" não depende de
 * ninguém lembrar de preencher um campo.
 *
 * Loja que saiu do ar nesses três dias não recebe: a pergunta é sobre como está
 * indo, e ela não está indo.
 */
export async function pedirIndicacoes(agora = new Date()): Promise<ResumoAviso> {
  const dormindo = porQueDormindo("loja.indicacoes");
  if (dormindo) return { dormindo, candidatos: 0, emitidos: 0, slugs: [] };

  const ativacoes = await prisma.automacaoEvento.findMany({
    where: {
      tipo: "loja.ativada",
      emitidoEm: {
        lte: new Date(agora.getTime() - INDICACOES_DEPOIS_DE_DIAS * 86_400_000),
        gte: new Date(agora.getTime() - INDICACOES_ATE_DIAS * 86_400_000),
      },
    },
    select: { slug: true },
    take: 100,
  });

  const slugs = [...new Set(ativacoes.map((a) => a.slug))];
  const avisados = await jaAvisados("loja.indicacoes", slugs.map((s) => `loja:${s}`));
  const lojas = slugs.length
    ? await prisma.tenant.findMany({ where: { slug: { in: slugs }, status: "ATIVA" } })
    : [];

  const resumo: ResumoAviso = { candidatos: lojas.length, emitidos: 0, slugs: [] };
  for (const loja of lojas) {
    if (avisados.has(`loja:${loja.slug}`)) continue;
    await emitir({
      tipo: "loja.indicacoes",
      slug: loja.slug,
      nome: loja.nome,
      url: urlDaLoja(loja),
      emailContato: loja.loginEmail ?? loja.emailContato,
      whatsapp: loja.whatsapp,
    });
    resumo.emitidos++;
    resumo.slugs.push(loja.slug);
  }
  return resumo;
}
