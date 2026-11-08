import { prisma } from "./db";
import { listarProdutos } from "./catalogo";
import { chaveDemandaPk } from "./pk-demanda-busca";
import { resolverPeriodoAnalytics } from "./analytics-vendas";

const DIA = 86_400_000;

/** A rotina diária pode chamar sem tenant; remove apenas agregados PK expirados. */
export async function expurgarDemandasPk(agora = new Date()) {
  const dia = chaveDemandaPk("retencao", "pkvedacoes", "123", agora)!.dia;
  return prisma.demandaBuscaPk.deleteMany({ where: { tenant: { slug: "pkvedacoes" }, dia: { lt: new Date(dia.getTime() - 89 * DIA) } } });
}

export async function registrarDemandaPk(tenant: { id: string; slug: string }, busca: unknown, agora = new Date()) {
  const chave = chaveDemandaPk(tenant.id, tenant.slug, busca, agora);
  if (!chave) return false;
  // A busca normalizada é a mesma consultada e agregada; nunca aceite o estado declarado pelo cliente.
  const produtos = await listarProdutos(tenant.id, { busca: chave.consulta, limite: 1 });
  if (produtos.length) return false;
  await prisma.$transaction([
    prisma.demandaBuscaPk.deleteMany({ where: { tenantId: tenant.id, dia: { lt: new Date(chave.dia.getTime() - 89 * DIA) } } }),
    prisma.demandaBuscaPk.upsert({ where: { tenantId_tipo_consulta_dia: chave }, create: { ...chave, ocorrencias: 1 }, update: { ocorrencias: { increment: 1 } } }),
  ]);
  return true;
}

export async function relatorioDemandasPk(tenant: { id: string; slug: string }, agora = new Date()) {
  if (tenant.slug !== "pkvedacoes") return [];
  const periodo = resolverPeriodoAnalytics({ periodo: "30d" }, agora);
  // Datas da agregação são rótulos locais à meia-noite UTC; alinhe o período ao mesmo calendário.
  const dia = (d: Date) => chaveDemandaPk(tenant.id, tenant.slug, "123", d)!.dia;
  await prisma.demandaBuscaPk.deleteMany({ where: { tenantId: tenant.id, dia: { lt: new Date(dia(agora).getTime() - 89 * DIA) } } });
  return prisma.demandaBuscaPk.groupBy({ by: ["tipo", "consulta"], where: { tenantId: tenant.id, dia: { gte: dia(periodo.de), lte: dia(agora) } }, _sum: { ocorrencias: true }, orderBy: [{ _sum: { ocorrencias: "desc" } }, { consulta: "asc" }], take: 50 });
}
