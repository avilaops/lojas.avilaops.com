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
      topProdutos: top || "—",
      carrinhosAbandonados: abandonados,
      novasAvaliacoes: avaliacoes,
    });
    enviados++;
  }
  return { lojas: enviados };
}
