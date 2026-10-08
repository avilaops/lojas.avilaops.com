import { prisma } from "@/lib/db";
import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { produtoDaVitrine, varianteDaVitrine } from "@/lib/api-recursos";
import { ErroApi } from "@/lib/api-resposta";
import { INCLUIR_OFERTA, ofertaDaVariante } from "@/lib/catalogo-oferta";
import { lojaVende, urlDaLoja } from "@/lib/tenant";

/**
 * GET /api/v1/vitrine/produtos/{id} — a página de um produto, para um front
 * próprio. Aceita o id ou o slug. Só produto ativo: inativo responde 404, como
 * na loja.
 *
 * É aqui que aparecem as variações: a listagem não as traz, e sem o `id` de
 * cada uma o front só conseguiria vender a apresentação padrão.
 */
export const dynamic = "force-dynamic";

export const GET = rotaDaApi<{ id: string }>({ escopo: "vitrine:ler", navegador: true }, async ({ tenant, params }) => {
  const produto = await prisma.produto.findFirst({
    where: { tenantId: tenant.id, ativo: true, OR: [{ id: params.id }, { slug: params.id }] },
    include: {
      categoria: { select: { id: true, slug: true, nome: true } },
      variantes: { where: { ativo: true, padrao: false }, orderBy: [{ ordem: "asc" }, { id: "asc" }], include: INCLUIR_OFERTA },
    },
  });
  if (!produto) throw new ErroApi("nao_encontrado", "Produto não encontrado nesta loja.");

  const { variantes, ...resto } = produto;
  return {
    dados: {
      ...produtoDaVitrine(resto, { url: urlDaLoja(tenant), vende: lojaVende(tenant) }),
      descricao: produto.descricao,
      opcoes: produto.opcoes,
      variantes: variantes.map((v) => varianteDaVitrine(produto.id, ofertaDaVariante(v))),
    },
  };
});

export const OPTIONS = preVooDaVitrine;
