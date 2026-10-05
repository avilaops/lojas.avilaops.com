import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { produtoDaApi } from "@/lib/api-recursos";
import { ErroApi } from "@/lib/api-resposta";
import { urlDaLoja } from "@/lib/tenant";

/** GET /api/v1/produtos/{id} — um produto, com as variações. Aceita o id ou o slug. */
export const dynamic = "force-dynamic";

export const GET = rotaDaApi<{ id: string }>({ escopo: "catalogo:ler" }, async ({ tenant, params }) => {
  const produto = await prisma.produto.findFirst({
    // O tenantId vem da chave: id de produto de outra loja responde 404, igual a id inexistente.
    where: { tenantId: tenant.id, OR: [{ id: params.id }, { slug: params.id }] },
    include: {
      categoria: { select: { id: true, slug: true, nome: true } },
      variantes: { where: { padrao: false }, orderBy: [{ ordem: "asc" }, { id: "asc" }] },
    },
  });
  if (!produto) throw new ErroApi("nao_encontrado", "Produto não encontrado nesta loja.");

  const { variantes, ...resto } = produto;
  return { dados: produtoDaApi(resto, urlDaLoja(tenant), variantes) };
});
