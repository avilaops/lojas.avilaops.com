import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { produtoDaApi } from "@/lib/api-recursos";
import { editarProdutoPelaApi, EdicaoDeProduto } from "@/lib/api-produtos";
import { ErroApi, lerCorpo } from "@/lib/api-resposta";
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

/**
 * PATCH /api/v1/produtos/{id} — edita o cadastro: nome, endereço, marca,
 * descrições, categoria, ativo e destaque.
 *
 * Preço e estoque não passam por aqui: são de `PATCH /api/v1/ofertas`. Os
 * valores são absolutos, então reenviar a mesma edição não muda nada.
 */
export const PATCH = rotaDaApi<{ id: string }>({ escopo: "produtos:escrever" }, async ({ request, tenant, chave, params }) => {
  const dados = await lerCorpo(request, EdicaoDeProduto);
  const produto = await editarProdutoPelaApi(tenant.id, params.id, dados, `api:${chave.id}`);
  const { variantes, ...resto } = produto;
  return { dados: produtoDaApi(resto, urlDaLoja(tenant), variantes) };
});
