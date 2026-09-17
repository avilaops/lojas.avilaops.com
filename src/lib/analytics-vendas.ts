import { prisma } from "./db";

export const FUSO_ANALYTICS = "America/Sao_Paulo";
export const STATUS_VENDA_ANALYTICS = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"] as const;

export type PeriodoAnalytics = {
  chave: "hoje" | "7d" | "30d" | "90d" | "personalizado";
  de: Date;
  ate: Date;
  anteriorDe: Date;
  anteriorAte: Date;
  rotulo: string;
};

const DIA = 86_400_000;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Converte meia-noite de Sao Paulo em UTC. O Brasil nao usa horario de verao desde 2019. */
export function inicioDoDia(data: string): Date {
  return new Date(`${data}T00:00:00-03:00`);
}

function fimDoDia(data: string): Date {
  return new Date(`${data}T23:59:59.999-03:00`);
}

export function isoLocal(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_ANALYTICS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function rotuloData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_ANALYTICS, day: "2-digit", month: "short" }).format(data).replace(".", "");
}

export function resolverPeriodoAnalytics(
  entrada: { periodo?: string; de?: string; ate?: string },
  agora = new Date(),
): PeriodoAnalytics {
  const hoje = isoLocal(agora);
  let chave: PeriodoAnalytics["chave"] = "30d";
  let de: Date;
  let ate: Date = fimDoDia(hoje);

  if (entrada.de && entrada.ate && DATA.test(entrada.de) && DATA.test(entrada.ate)) {
    const inicio = inicioDoDia(entrada.de);
    const fim = fimDoDia(entrada.ate);
    if (inicio <= fim && fim.getTime() - inicio.getTime() <= 366 * DIA) {
      chave = "personalizado";
      de = inicio;
      ate = fim;
    } else {
      de = new Date(ate.getTime() - 29 * DIA + 1);
    }
  } else {
    const dias = entrada.periodo === "hoje" ? 1 : entrada.periodo === "7d" ? 7 : entrada.periodo === "90d" ? 90 : 30;
    chave = dias === 1 ? "hoje" : `${dias}d` as PeriodoAnalytics["chave"];
    de = inicioDoDia(isoLocal(new Date(agora.getTime() - (dias - 1) * DIA)));
  }

  const duracao = ate.getTime() - de.getTime() + 1;
  const anteriorAte = new Date(de.getTime() - 1);
  const anteriorDe = new Date(anteriorAte.getTime() - duracao + 1);
  return {
    chave,
    de,
    ate,
    anteriorDe,
    anteriorAte,
    rotulo: chave === "personalizado" ? `${rotuloData(de)} a ${rotuloData(ate)}` : chave === "hoje" ? "Hoje" : `Ultimos ${chave.replace("d", "")} dias`,
  };
}

type VendaBase = {
  criadoEm: Date;
  subtotalCentavos: number;
  descontoCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  clienteEmail: string;
  itens: Array<{ produtoId: string | null; nome: string; quantidade: number; precoUnitarioCentavos: number }>;
};

export type ResumoAnalyticsVendas = {
  receitaBrutaCentavos: number;
  descontosCentavos: number;
  freteCentavos: number;
  receitaRecebidaCentavos: number;
  pedidos: number;
  ticketMedioCentavos: number;
  itensVendidos: number;
  clientesCompradores: number;
  comparacao: { receita: number | null; pedidos: number | null; ticket: number | null };
  serie: Array<{ dia: string; rotulo: string; receitaCentavos: number; pedidos: number }>;
  produtos: Array<{ produtoId: string | null; nome: string; quantidade: number; receitaCentavos: number }>;
};

function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function somar(vendas: VendaBase[]) {
  const receita = vendas.reduce((s, p) => s + p.totalCentavos, 0);
  return { receita, pedidos: vendas.length, ticket: vendas.length ? Math.round(receita / vendas.length) : 0 };
}

export function calcularResumoAnalytics(vendas: VendaBase[], periodo: PeriodoAnalytics): ResumoAnalyticsVendas {
  const atuais = vendas.filter((p) => p.criadoEm >= periodo.de && p.criadoEm <= periodo.ate);
  const anteriores = vendas.filter((p) => p.criadoEm >= periodo.anteriorDe && p.criadoEm <= periodo.anteriorAte);
  const atual = somar(atuais);
  const anterior = somar(anteriores);
  const porDia = new Map<string, { receitaCentavos: number; pedidos: number }>();
  for (let cursor = periodo.de.getTime(); cursor <= periodo.ate.getTime(); cursor += DIA) {
    porDia.set(isoLocal(new Date(cursor)), { receitaCentavos: 0, pedidos: 0 });
  }
  const produtos = new Map<string, { produtoId: string | null; nome: string; quantidade: number; receitaCentavos: number }>();
  for (const pedido of atuais) {
    const dia = isoLocal(pedido.criadoEm);
    const ponto = porDia.get(dia);
    if (ponto) {
      ponto.receitaCentavos += pedido.totalCentavos;
      ponto.pedidos++;
    }
    for (const item of pedido.itens) {
      const chave = item.produtoId ?? item.nome;
      const existente = produtos.get(chave) ?? { produtoId: item.produtoId, nome: item.nome, quantidade: 0, receitaCentavos: 0 };
      existente.quantidade += item.quantidade;
      existente.receitaCentavos += item.quantidade * item.precoUnitarioCentavos;
      produtos.set(chave, existente);
    }
  }
  return {
    receitaBrutaCentavos: atuais.reduce((s, p) => s + p.subtotalCentavos + p.descontoCentavos, 0),
    descontosCentavos: atuais.reduce((s, p) => s + p.descontoCentavos, 0),
    freteCentavos: atuais.reduce((s, p) => s + p.freteCentavos, 0),
    receitaRecebidaCentavos: atual.receita,
    pedidos: atual.pedidos,
    ticketMedioCentavos: atual.ticket,
    itensVendidos: atuais.flatMap((p) => p.itens).reduce((s, i) => s + i.quantidade, 0),
    clientesCompradores: new Set(atuais.map((p) => p.clienteEmail.trim().toLowerCase())).size,
    comparacao: {
      receita: variacao(atual.receita, anterior.receita),
      pedidos: variacao(atual.pedidos, anterior.pedidos),
      ticket: variacao(atual.ticket, anterior.ticket),
    },
    serie: Array.from(porDia, ([dia, valores]) => ({ dia, rotulo: rotuloData(inicioDoDia(dia)), ...valores })),
    produtos: Array.from(produtos.values()).sort((a, b) => b.receitaCentavos - a.receitaCentavos).slice(0, 5),
  };
}

export async function analyticsDeVendas(tenantId: string, periodo: PeriodoAnalytics): Promise<ResumoAnalyticsVendas> {
  const vendas = await prisma.pedido.findMany({
    where: {
      tenantId,
      status: { in: [...STATUS_VENDA_ANALYTICS] },
      criadoEm: { gte: periodo.anteriorDe, lte: periodo.ate },
    },
    select: {
      criadoEm: true,
      subtotalCentavos: true,
      descontoCentavos: true,
      freteCentavos: true,
      totalCentavos: true,
      clienteEmail: true,
      itens: { select: { produtoId: true, nome: true, quantidade: true, precoUnitarioCentavos: true } },
    },
    orderBy: { criadoEm: "asc" },
  });
  return calcularResumoAnalytics(vendas, periodo);
}
