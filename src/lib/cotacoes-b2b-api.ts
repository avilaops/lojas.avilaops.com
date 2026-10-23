import { autorizado, naoAutorizado } from "./admin-auth";
import { prisma } from "./db";

export async function contextoCotacao(request: Request, slug: string) {
  if (!autorizado(request)) return { resposta: naoAutorizado() } as const;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return { resposta: Response.json({ erro: "loja não encontrada" }, { status: 404 }) } as const;
  return { tenant } as const;
}

export function erroCotacao(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "operação de cotação não concluída";
  const status = /não encontrad/i.test(mensagem) ? 404 : /transição|expirad|alçada|escopo|precisa estar|indisponível|inválid|exige/i.test(mensagem) ? 422 : 409;
  return Response.json({ erro: mensagem }, { status });
}
