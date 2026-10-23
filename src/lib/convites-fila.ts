import { prisma } from "./db";
import { configConvite, convidarParaAEquipe } from "./convite-equipe";

/** Fila persistente baseada em OperadorLoja, isolada por tenant e idempotente.
 * O updateMany é uma reivindicação atômica para dois workers não enviarem
 * o mesmo convite simultaneamente. O lease de 10 minutos recupera crashes.
 */
export async function processarConvitesPendentes(limite = 50) {
  const cfg = configConvite();
  if (!cfg) return { processados: 0, pendentes: true, motivo: "Auth sem integração de provisionamento" };
  const agora = new Date();
  const corte = new Date(agora.getTime() - 10 * 60_000);
  const candidatos = await prisma.operadorLoja.findMany({
    where: { ativo: true, OR: [
      { conviteSituacao: "PENDENTE" },
      { conviteSituacao: "FALHOU", conviteEm: { lt: corte } },
      { conviteSituacao: "PROCESSANDO", conviteEm: { lt: corte } },
    ] },
    select: { id: true, tenantId: true, nome: true, email: true, conviteSituacao: true, conviteEm: true, tenant: { select: { nome: true } } },
    orderBy: [{ conviteEm: "asc" }, { criadoEm: "asc" }], take: Math.min(100, Math.max(1, limite)),
  });
  let enviados = 0, falhas = 0;
  for (const c of candidatos) {
    const reivindicado = await prisma.operadorLoja.updateMany({
      where: { id: c.id, tenantId: c.tenantId, ativo: true, conviteSituacao: c.conviteSituacao,
        conviteEm: c.conviteEm },
      data: { conviteSituacao: "PROCESSANDO", conviteEm: new Date(), conviteDetalhe: "Provisionamento em execução" },
    });
    if (!reivindicado.count) continue;
    const resposta = await convidarParaAEquipe(cfg, {
      email: c.email, nome: c.nome, loja: c.tenant.nome,
      hostBase: (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase(),
    });
    await prisma.operadorLoja.updateMany({
      where: { id: c.id, tenantId: c.tenantId, conviteSituacao: "PROCESSANDO" },
      data: { conviteSituacao: resposta.situacao, conviteDetalhe: resposta.detalhe.slice(0, 300), conviteEm: new Date() },
    });
    if (resposta.situacao === "ENVIADO") enviados++; else falhas++;
  }
  return { processados: candidatos.length, enviados, falhas };
}
