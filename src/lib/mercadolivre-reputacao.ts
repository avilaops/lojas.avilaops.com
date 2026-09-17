import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl } from "./mercadolivre";

/**
 * A saúde da conta da loja no Mercado Livre.
 *
 * O ML classifica quem vende por reclamação, atraso no envio e cancelamento —
 * e o lojista descobre que caiu de nível quando a venda some, não quando a
 * métrica passa do limite. A plataforma já fala com a API de qualquer jeito
 * (publicação e estoque); trazer isso junto custa uma chamada por ciclo.
 *
 * Aqui não se calcula reputação: quem calcula é o ML. O que este arquivo faz
 * é **traduzir** o que ele devolve para o que o lojista pode fazer a respeito.
 */

export interface ReputacaoMl {
  seller_reputation?: {
    level_id?: string | null;
    power_seller_status?: string | null;
    transactions?: { total?: number; completed?: number; canceled?: number; ratings?: { positive?: number; neutral?: number; negative?: number } };
    metrics?: {
      claims?: { rate?: number; value?: number };
      delayed_handling_time?: { rate?: number; value?: number };
      cancellations?: { rate?: number; value?: number };
    };
  };
}

/**
 * Os limites que o ML publica para a cor amarela. Ficam aqui, num só lugar e
 * com nome, porque a régua muda: quando mudar, muda-se este bloco, e não
 * cinco condições espalhadas pela tela.
 */
export const LIMITES = { reclamacoes: 2, atrasos: 15, cancelamentos: 2 } as const;

export interface Reputacao {
  nivel: string | null;
  selo: string | null;
  transacoes: number;
  concluidas: number;
  canceladas: number;
  reclamacoes: number | null;
  atrasos: number | null;
  cancelamentos: number | null;
  positivas: number | null;
  neutras: number | null;
  negativas: number | null;
  alertas: string[];
}

/** O ML manda taxa de 0 a 1; a tela fala em porcentagem. */
function porcento(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 1000) / 10 : null;
}

/**
 * Traduz a reputação em frases acionáveis.
 *
 * Só entra alerta com número medido: conta nova não tem métrica, e dizer
 * "suas reclamações estão altas" para quem ainda não vendeu seria inventar
 * problema. Cada frase diz o que está acontecendo e o que mudaria isso.
 */
export function lerReputacao(bruto: ReputacaoMl): Reputacao {
  const r = bruto.seller_reputation ?? {};
  const t = r.transactions ?? {};
  const m = r.metrics ?? {};
  const reclamacoes = porcento(m.claims?.rate);
  const atrasos = porcento(m.delayed_handling_time?.rate);
  const cancelamentos = porcento(m.cancellations?.rate);

  const alertas: string[] = [];
  if (reclamacoes != null && reclamacoes > LIMITES.reclamacoes) {
    alertas.push(`Reclamações em ${reclamacoes}% das vendas, acima do limite de ${LIMITES.reclamacoes}% do Mercado Livre. Responder a pergunta antes da compra é o que mais derruba esse número.`);
  }
  if (atrasos != null && atrasos > LIMITES.atrasos) {
    alertas.push(`${atrasos}% dos envios saíram com atraso (o limite é ${LIMITES.atrasos}%). Rever o prazo de despacho da loja costuma resolver mais que correr com a postagem.`);
  }
  if (cancelamentos != null && cancelamentos > LIMITES.cancelamentos) {
    alertas.push(`${cancelamentos}% das vendas foram canceladas por você, acima de ${LIMITES.cancelamentos}%. Em geral é estoque anunciado que não existia: a sincronização de estoque evita isso.`);
  }
  if (r.power_seller_status == null && (t.completed ?? 0) > 0) {
    alertas.push("A conta ainda não tem selo de Mercado Líder. Ele sai de volume, reputação verde e tempo de conta — não há atalho.");
  }

  return {
    nivel: r.level_id ?? null,
    selo: r.power_seller_status ?? null,
    transacoes: t.total ?? 0,
    concluidas: t.completed ?? 0,
    canceladas: t.canceled ?? 0,
    reclamacoes,
    atrasos,
    cancelamentos,
    positivas: porcento(t.ratings?.positive),
    neutras: porcento(t.ratings?.neutral),
    negativas: porcento(t.ratings?.negative),
    alertas,
  };
}

/** Lê no ML e guarda o retrato. Uma chamada por ciclo, por loja conectada. */
export async function atualizarReputacaoMl(loja: Tenant) {
  if (!loja.mlUserId) return null;
  const bruto = await chamarMl<ReputacaoMl>(loja, `/users/${encodeURIComponent(loja.mlUserId)}`);
  const r = lerReputacao(bruto);
  const dados = { ...r, alertas: r.alertas as unknown as object, medidoEm: new Date() };
  await prisma.reputacaoMercadoLivre.upsert({ where: { tenantId: loja.id }, create: { tenantId: loja.id, ...dados }, update: dados });
  return r;
}
