import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { produtoDaVitrine } from "@/lib/api-recursos";
import { lerBooleano, lerOpcao, lerPaginacao, lista } from "@/lib/api-resposta";
import { paginaDeProdutos, type OrdemCatalogo } from "@/lib/catalogo";
import { lojaVende, urlDaLoja } from "@/lib/tenant";

/**
 * GET /api/v1/vitrine/produtos — a listagem da vitrine, para um front próprio.
 *
 * É a mesma consulta da página de categoria (`paginaDeProdutos`): só ativos,
 * mesma busca e mesma ordem. Um front headless não pode mostrar um catálogo
 * diferente do que a loja mostra.
 */
export const dynamic = "force-dynamic";

const ORDENS: readonly OrdemCatalogo[] = ["relevancia", "menor-preco", "maior-preco", "recentes", "nome"];

export const GET = rotaDaApi({ escopo: "vitrine:ler", navegador: true }, async ({ tenant, url }) => {
  const q = url.searchParams;
  const pagina = lerPaginacao(q);
  const { total, produtos } = await paginaDeProdutos(
    tenant.id,
    {
      busca: q.get("busca") || undefined,
      categoriaSlug: q.get("categoria") || undefined,
      destaque: lerBooleano(q, "destaque") ?? undefined,
      ordem: lerOpcao(q, "ordem", ORDENS) ?? undefined,
    },
    pagina.porPagina,
    pagina.pular,
  );

  const loja = { url: urlDaLoja(tenant), vende: lojaVende(tenant) };
  return lista(produtos.map((p) => produtoDaVitrine(p, loja)), pagina, total);
});

export const OPTIONS = preVooDaVitrine;
