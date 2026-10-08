import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  ROTINAS,
  NOMES_DE_ROTINA,
  proximaExecucao,
  type NomeDeRotina,
} from "./rotinas";
import { verificarCarrinhosAbandonados } from "./carrinhos";
import { avisarQuemEsperava } from "./estoque-avisos";
import { reconciliarPagamentosPendentes } from "./pedidos-reconciliar";
import { verificarInadimplencia } from "./assinatura";
import { emitirRelatoriosSemanais } from "./relatorio";
import { processarSeoCategoriasPendentes } from "./seo-categorias";
import { processarAvisosMl } from "./mercadolivre-avisos";
import { rodarMercadoLivre } from "./mercadolivre-publicacao";
import { processarEventosProprios } from "./automacoes-consumo";
import { lembrarPixPendente, pedirIndicacoes } from "./avisos-que-esperam";
import { renovarAcessos as renovarAcessosDoMercadoPago } from "./mercado-pago-conta";
import { alertar } from "./alertas";
import { entregarWebhooks } from "./webhooks-entrega";

/** Quantas falhas seguidas de uma rotina viram alerta para gente. */
export const FALHAS_ATE_ALERTAR = 3;

/**
 * Quem faz o trabalho de cada rotina.
 *
 * O tipo obriga a tabela a cobrir o catálogo inteiro: acrescentar uma rotina
 * em `ROTINAS` sem dizer aqui o que ela faz não compila. É o que impede uma
 * rotina de existir na tela de operação e nunca rodar.
 *
 * Todas as funções já existiam — o que mudou foi quem chama.
 */
const TRABALHOS: Record<NomeDeRotina, () => Promise<unknown>> = {
  // 100 por passada, e não o padrão de 50: a cada 5 min dá 1.200 avisos por
  // hora de folga, o suficiente para absorver uma rajada de vendas sem a
  // fila crescer mais rápido do que é esvaziada.
  "mercadolivre.avisos": () => processarAvisosMl({ limite: 100 }),
  "mercadolivre.rodar": () => rodarMercadoLivre({}),
  // Falha de envio não derruba a rotina: ela vira FALHOU no próprio evento,
  // que é onde a tela de automações procura. O resumo carrega a contagem.
  "automacoes.eventos": () => processarEventosProprios({ limite: 50 }),
  // As duas dormem enquanto o n8n ainda receber o evento que as dispara; o
  // resumo diz isso em vez de parecer que rodou e não achou ninguém.
  "webhooks.entregar": () => entregarWebhooks({ limite: 50 }),
  "pix.lembrete": () => lembrarPixPendente(),
  "loja.indicacoes": () => pedirIndicacoes(),
  "carrinhos.verificar": () => verificarCarrinhosAbandonados(),
  "estoque.avisos": () => avisarQuemEsperava(),
  "pedidos.verificar": () => reconciliarPagamentosPendentes(),
  "mercadopago.renovar": () => renovarAcessosDoMercadoPago(),
  "seo.categorias": () => processarSeoCategoriasPendentes({ limite: 10 }),
  "cobranca.verificar": () => verificarInadimplencia(),
  "relatorios.semanal": () => emitirRelatoriosSemanais(),
};

export interface ResultadoDaRotina {
  nome: NomeDeRotina;
  duracaoMs: number;
  resumo?: unknown;
  erro?: string;
}

/**
 * Cria a linha que falta para cada rotina do catálogo.
 *
 * Rotina de intervalo nasce vencida: é idempotente e rodar uma vez a mais logo
 * depois de um deploy não custa nada. Rotina de horário nasce apontando para a
 * próxima ocorrência — subir o container numa terça não pode disparar o
 * relatório semanal de segunda.
 */
async function garantirLinhas(agora: Date): Promise<void> {
  const existentes = new Set(
    (await prisma.rotina.findMany({ select: { nome: true } })).map((r) => r.nome),
  );
  const faltando = NOMES_DE_ROTINA.filter((nome) => !existentes.has(nome));
  if (!faltando.length) return;
  await prisma.rotina.createMany({
    data: faltando.map((nome) => {
      const { cadencia } = ROTINAS[nome];
      return { nome, proximaEm: cadencia.tipo === "intervalo" ? agora : proximaExecucao(cadencia, agora) };
    }),
    skipDuplicates: true,
  });
}

/**
 * Reivindica a rotina para este processo.
 *
 * Um `UPDATE … WHERE proximaEm <= agora AND (executandoDesde IS NULL OR trava
 * vencida)`: dois containers do mesmo deploy tentam e só um recebe `count = 1`.
 * Mesmo padrão do `AutomacaoEvento` e da fila de perguntas do Mercado Livre.
 */
async function reivindicar(nome: NomeDeRotina, agora: Date): Promise<boolean> {
  const travaVencida = new Date(agora.getTime() - ROTINAS[nome].travaMinutos * 60_000);
  const { count } = await prisma.rotina.updateMany({
    where: {
      nome,
      proximaEm: { lte: agora },
      OR: [{ executandoDesde: null }, { executandoDesde: { lt: travaVencida } }],
    },
    data: { executandoDesde: agora },
  });
  return count === 1;
}

/**
 * A mensagem de erro em uma linha, curta o bastante para caber numa tabela.
 *
 * Erro do Prisma vem com o trecho do código e a frase que importa no fim —
 * cortar só o começo jogaria fora justamente "a tabela X não existe". Por isso
 * o corte tira o miolo, não o fim.
 */
function mensagemCurta(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : "falha inesperada";
  const limpo = bruto.replace(/\s+/g, " ").trim() || "falha inesperada";
  if (limpo.length <= 500) return limpo;
  return `${limpo.slice(0, 240)} […] ${limpo.slice(-240)}`;
}

/** O resumo cabe em JSON? O que a rotina devolve é contagem, mas não confio. */
function comoJson(valor: unknown): Prisma.InputJsonValue | undefined {
  try {
    const texto = JSON.stringify(valor ?? null);
    if (!texto || texto.length > 20_000) return undefined;
    return JSON.parse(texto) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/**
 * Roda uma rotina, aconteça o que acontecer com o `proximaEm`.
 *
 * O horário avança mesmo quando a rotina falha: rotina quebrada que não avança
 * vira laço apertado a cada tique, martelando um serviço que já está com
 * problema. O que sinaliza a quebra é `falhasSeguidas`, não a fila parada.
 */
async function executar(nome: NomeDeRotina): Promise<ResultadoDaRotina> {
  const comecou = Date.now();
  let resumo: unknown;
  let erro: string | undefined;
  try {
    resumo = await TRABALHOS[nome]();
  } catch (falha) {
    erro = mensagemCurta(falha);
  }
  const duracaoMs = Date.now() - comecou;
  const fim = new Date();
  const depois = await prisma.rotina.update({
    where: { nome },
    select: { falhasSeguidas: true },
    data: {
      executandoDesde: null,
      ultimaEm: fim,
      ultimaDuracaoMs: duracaoMs,
      ultimoResumo: erro ? undefined : (comoJson(resumo) ?? Prisma.DbNull),
      ultimoErro: erro ?? null,
      falhasSeguidas: erro ? { increment: 1 } : 0,
      execucoes: { increment: 1 },
      proximaEm: proximaExecucao(ROTINAS[nome].cadencia, fim),
    },
  });
  // Na terceira, e só nela: uma falha isolada se resolve sozinha na rodada
  // seguinte, e avisar a cada rodada de uma rotina de minuto seria ruído.
  if (erro && depois.falhasSeguidas === FALHAS_ATE_ALERTAR) {
    await alertar({ codigo: "rotina.falhando", slug: "plataforma", lojaNome: "Plataforma", recurso: nome, detalhe: erro, ocorrencia: fim.toISOString().slice(0, 10) });
  }
  return { nome, duracaoMs, resumo, erro };
}

/**
 * Uma passada do agendador: roda o que venceu, uma rotina por vez.
 *
 * Em série de propósito — são trabalhos de fundo no mesmo processo que serve a
 * vitrine, e disparar oito de uma vez às 3h da manhã competiria com o
 * comprador. Nada aqui demora mais que um lote.
 */
export async function executarRotinasDevidas(agora = new Date()): Promise<ResultadoDaRotina[]> {
  await garantirLinhas(agora);
  const devidas = await prisma.rotina.findMany({
    where: { nome: { in: NOMES_DE_ROTINA }, proximaEm: { lte: agora } },
    orderBy: { proximaEm: "asc" },
    select: { nome: true },
  });
  const feitas: ResultadoDaRotina[] = [];
  for (const { nome } of devidas) {
    if (!isNomeConhecido(nome)) continue;
    if (!(await reivindicar(nome, agora))) continue;
    feitas.push(await executar(nome));
  }
  return feitas;
}

/**
 * Disparo manual de uma rotina, ignorando o horário.
 *
 * Continua respeitando a trava: "rodar agora" apertado duas vezes não coloca
 * duas execuções da mesma rotina no ar.
 */
export async function forcarRotina(nome: NomeDeRotina): Promise<ResultadoDaRotina | null> {
  const agora = new Date();
  await garantirLinhas(agora);
  const travaVencida = new Date(agora.getTime() - ROTINAS[nome].travaMinutos * 60_000);
  const { count } = await prisma.rotina.updateMany({
    where: { nome, OR: [{ executandoDesde: null }, { executandoDesde: { lt: travaVencida } }] },
    data: { executandoDesde: agora },
  });
  if (count !== 1) return null;
  return executar(nome);
}

function isNomeConhecido(nome: string): nome is NomeDeRotina {
  return (NOMES_DE_ROTINA as string[]).includes(nome);
}
