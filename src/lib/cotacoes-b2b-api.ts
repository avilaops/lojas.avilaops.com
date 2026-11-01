import { autorizado, naoAutorizado } from "./admin-auth";
import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { ErroCotacaoB2B } from "./cotacoes-b2b-erros";
import { ErroCatalogo } from "./catalogo-oferta";

export async function contextoCotacao(request: Request, slug: string) {
  if (!autorizado(request)) return { resposta: naoAutorizado() } as const;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return { resposta: Response.json({ erro: "loja não encontrada" }, { status: 404 }) } as const;
  return { tenant } as const;
}

export function erroCotacao(erro: unknown) {
  if (erro instanceof ErroCotacaoB2B || erro instanceof ErroCatalogo) return Response.json({ erro: erro.message }, { status: erro.status });
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === "P2025") return Response.json({ erro: "Cotação ou referência não encontrada." }, { status: 404 });
    if (erro.code === "P2002") return Response.json({ erro: "A referência ou chave já foi usada. Confira o pedido antes de tentar novamente." }, { status: 409 });
  }
  return Response.json({ erro: "Não foi possível concluir a operação agora. Recarregue a cotação antes de tentar novamente." }, { status: 500 });
}
