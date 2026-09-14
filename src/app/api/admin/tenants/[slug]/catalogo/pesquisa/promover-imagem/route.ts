import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { PromoverImagemPesquisaSchema, promoverImagemPesquisa } from "@/lib/pesquisa-catalogo";
import { respostaErroCatalogo } from "@/lib/catalogo-escrita";

type Ctx = { params: Promise<{ slug: string }> };

/** Promove uma evidência já revisada; pesquisa bruta nunca publica foto. */
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const tenant = await prisma.tenant.findUnique({ where: { slug: (await params).slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "Loja não encontrada." }, { status: 404 });
  const entrada = PromoverImagemPesquisaSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Promoção inválida.", detalhes: entrada.error.flatten() }, { status: 422 });
  try {
    return Response.json(await promoverImagemPesquisa(tenant.id, entrada.data.imagemCandidataId, entrada.data.versaoCatalogo));
  } catch (erro) {
    return respostaErroCatalogo(erro);
  }
}
