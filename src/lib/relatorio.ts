import { prisma } from "./db";
import { emitir } from "./eventos";
import { urlDaLoja } from "./tenant";

/**
 * Relatório semanal por loja: emite `loja.relatorio-semanal` (o n8n manda o
 * e-mail). Segunda de manhã, pelo Schedule do n8n → /api/admin/relatorios/semanal.
 */
export async function emitirRelatoriosSemanais(): Promise<{ lojas: number }> {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 7 * 86_400_000);
  const lojas = await prisma.tenant.findMany({ where: { status: "ATIVA" } });
  let enviados = 0;
  for (const t of lojas) {
    const [pagos, abandonados, avaliacoes] = await Promise.all([
      prisma.pedido.findMany({ where: { tenantId: t.id, status: { in: ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"] }, criadoEm: { gte: inicio, lte: fim } }, include: { itens: true } }),
      prisma.checkoutAberto.count({ where: { tenantId: t.id, status: { in: ["ABERTO", "LEMBRADO"] }, criadoEm: { gte: inicio, lte: fim } } }),
      prisma.avaliacao.count({ where: { tenantId: t.id, criadoEm: { gte: inicio, lte: fim } } }),
    ]);
    const receita = pagos.reduce((s, p) => s + p.totalCentavos, 0);
    const porProduto = new Map<string, number>();
    for (const p of pagos) for (const i of p.itens) porProduto.set(i.nome, (porProduto.get(i.nome) ?? 0) + i.quantidade);
    const top = Array.from(porProduto.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => `${q}x ${n}`).join(", ");
    // Loja sem movimento nenhum na semana não recebe e-mail vazio.
    if (pagos.length === 0 && abandonados === 0 && avaliacoes === 0) continue;
    await emitir({
      tipo: "loja.relatorio-semanal",
      slug: t.slug,
      nome: t.nome,
      url: urlDaLoja(t),
      emailContato: t.loginEmail ?? t.emailContato,
      whatsapp: t.whatsapp,
      periodo: `${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`,
      pedidosPagos: pagos.length,
      receitaCentavos: receita,
      ticketMedioCentavos: pagos.length ? Math.round(receita / pagos.length) : 0,
      topProdutos: top || "-",
      carrinhosAbandonados: abandonados,
      novasAvaliacoes: avaliacoes,
    });
    enviados++;
  }
  return { lojas: enviados };
}

/** Um pedido só conta como venda depois de pago — e deixa de contar se for cancelado ou estornado. */
export const STATUS_VENDA = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"] as const;

export interface ResumoVendas {
  receitaCentavos: number;
  pedidos: number;
  ticketMedioCentavos: number;
  /** Variação da receita contra os 30 dias anteriores. `null` quando não havia base de comparação. */
  variacao: number | null;
  serie: Array<{ dia: string; centavos: number }>;
  top: Array<{ nome: string; quantidade: number; centavos: number }>;
  aguardandoPagamento: number;
  aSeparar: number;
  carrinhosAbertos: number;
}

const DIA = 86_400_000;
const FUSO = "America/Sao_Paulo";
const diaDe = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: FUSO });

/**
 * O que o lojista quer ver ao abrir o painel: quanto entrou, se está melhor que
 * no mês passado, o que vende e o que está parado esperando ele.
 *
 * Tudo sai de duas consultas dos últimos 60 dias — a comparação com o período
 * anterior vem do mesmo intervalo, sem uma segunda ida ao banco.
 */
export async function resumoDeVendas(tenantId: string): Promise<ResumoVendas> {
  const agora = new Date();
  const inicio30 = new Date(agora.getTime() - 30 * DIA);
  const inicio60 = new Date(agora.getTime() - 60 * DIA);

  const [vendas, aguardandoPagamento, aSeparar, carrinhosAbertos] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: { in: [...STATUS_VENDA] }, criadoEm: { gte: inicio60 } },
      select: { criadoEm: true, totalCentavos: true, itens: { select: { nome: true, quantidade: true, precoUnitarioCentavos: true } } },
      orderBy: { criadoEm: "asc" },
      take: 5000,
    }),
    prisma.pedido.count({ where: { tenantId, status: "AGUARDANDO_PAGAMENTO", criadoEm: { gte: inicio30 } } }),
    prisma.pedido.count({ where: { tenantId, status: "PAGO" } }),
    prisma.checkoutAberto.count({ where: { tenantId, status: { in: ["ABERTO", "LEMBRADO"] }, criadoEm: { gte: new Date(agora.getTime() - 7 * DIA) } } }),
  ]);

  const recentes = vendas.filter((p) => p.criadoEm >= inicio30);
  const anteriores = vendas.filter((p) => p.criadoEm < inicio30);
  const receitaCentavos = recentes.reduce((s, p) => s + p.totalCentavos, 0);
  const receitaAnterior = anteriores.reduce((s, p) => s + p.totalCentavos, 0);

  // Trinta caixinhas de dia já prontas: dia sem venda tem que aparecer como
  // zero no gráfico, não sumir e encurtar o mês.
  const porDia = new Map<string, number>();
  for (let i = 29; i >= 0; i--) porDia.set(diaDe(new Date(agora.getTime() - i * DIA)), 0);
  for (const p of recentes) {
    const dia = diaDe(p.criadoEm);
    if (porDia.has(dia)) porDia.set(dia, (porDia.get(dia) ?? 0) + p.totalCentavos);
  }

  const porProduto = new Map<string, { quantidade: number; centavos: number }>();
  for (const p of recentes)
    for (const i of p.itens) {
      const atual = porProduto.get(i.nome) ?? { quantidade: 0, centavos: 0 };
      porProduto.set(i.nome, { quantidade: atual.quantidade + i.quantidade, centavos: atual.centavos + i.quantidade * i.precoUnitarioCentavos });
    }

  return {
    receitaCentavos,
    pedidos: recentes.length,
    ticketMedioCentavos: recentes.length ? Math.round(receitaCentavos / recentes.length) : 0,
    variacao: receitaAnterior ? Math.round(((receitaCentavos - receitaAnterior) / receitaAnterior) * 100) : null,
    serie: Array.from(porDia, ([dia, centavos]) => ({ dia, centavos })),
    top: Array.from(porProduto, ([nome, v]) => ({ nome, ...v })).sort((a, b) => b.centavos - a.centavos).slice(0, 5),
    aguardandoPagamento,
    aSeparar,
    carrinhosAbertos,
  };
}
