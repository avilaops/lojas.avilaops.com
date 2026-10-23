import { prisma } from "./db";

/** Apenas vínculos explícitos ativos e propriedade legada comprovada. */
export async function lojasAutorizadas(email: string) {
  const alvo = email.trim().toLowerCase();
  if (!alvo.includes("@")) return [];
  const [vinculos, legada] = await Promise.all([
    prisma.acessoLoja.findMany({ where: { email: alvo, ativo: true, papel: "DONO", tenant: { status: { not: "CANCELADA" } } }, include: { tenant: true } }),
    prisma.tenant.findUnique({ where: { loginEmail: alvo } }),
  ]);
  const porId = new Map(vinculos.map(v => [v.tenant.id, v.tenant]));
  if (legada && legada.status !== "CANCELADA") porId.set(legada.id, legada);
  return [...porId.values()].sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function possuiLoja(email: string, tenantId: string) {
  const lojas = await lojasAutorizadas(email);
  return lojas.some(loja => loja.id === tenantId);
}
