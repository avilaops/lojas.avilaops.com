import { prisma } from "@/lib/db";
import { SEM_CACHE, autorizado, naoEncontrado, noDominioDaPlataforma } from "@/lib/gapp";

/**
 * GET /v1/stats — quantos usuários, quantos pedidos (CT-20).
 *
 * Só contagem. Nada aqui identifica lojista nem comprador: o plano de controle
 * não precisa saber quem são, e dado pessoal atravessando o contrato seria
 * transformar uma sonda de saúde num vazamento com agenda fixa.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await noDominioDaPlataforma())) return naoEncontrado();
  const auth = autorizado(request);
  if (!auth.ok) return auth.resposta;

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [lojas, lojasAtivas, produtos, pedidos, pedidos24h, compradores] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ATIVA" } }),
    prisma.produto.count({ where: { ativo: true } }),
    prisma.pedido.count(),
    prisma.pedido.count({ where: { criadoEm: { gte: desde } } }),
    prisma.comprador.count(),
  ]);

  return Response.json(
    {
      usuarios: lojas,
      usuarios_ativos: lojasAtivas,
      compradores,
      produtos_ativos: produtos,
      pedidos_total: pedidos,
      pedidos_24h: pedidos24h,
      emails_24h: 0,
      medido_em: new Date().toISOString(),
    },
    { headers: SEM_CACHE },
  );
}
