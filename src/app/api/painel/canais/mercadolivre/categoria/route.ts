import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import {
  CategoriaInvalida,
  ProdutoNaoEncontrado,
  definirCategoriaManual,
} from "@/lib/mercadolivre-categorias";
import type { Preparo } from "@/lib/mercadolivre-preparo";

/**
 * A categoria do Mercado Livre de um produto: ler o estado, definir à mão.
 *
 * Nenhum dos dois exige a conta conectada. O preditor e o catálogo de
 * categorias do ML são públicos, e o lojista precisa poder organizar tudo antes
 * de autorizar qualquer integração de venda.
 */
export const dynamic = "force-dynamic";

/** GET ?produtoId= — o que a tela precisa para abrir: sugestão, escolha e o que falta. */
export async function GET(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const produtoId = new URL(request.url).searchParams.get("produtoId") ?? "";
  if (!produtoId) return Response.json({ erro: "Informe o produto." }, { status: 422 });

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, tenantId: s.tenant.id },
    select: {
      id: true,
      nome: true,
      anunciosMl: {
        select: { categoriaMl: true, categoriaOrigem: true, categoriaDefinidaEm: true, preparo: true, preparoEstado: true },
      },
    },
  });
  if (!produto) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });

  const anuncio = produto.anunciosMl[0];
  const preparo = (anuncio?.preparo ?? null) as Preparo | null;

  return Response.json({
    produto: { id: produto.id, nome: produto.nome },
    categoriaId: anuncio?.categoriaMl ?? null,
    origem: anuncio?.categoriaOrigem ?? "automatica",
    definidaEm: anuncio?.categoriaDefinidaEm?.toISOString() ?? null,
    estado: anuncio?.preparoEstado ?? null,
    // A sugestão automática continua à vista mesmo depois da escolha manual: é
    // com ela que o lojista confere se mudou de ideia por um bom motivo.
    sugerida: preparo?.categoria ?? null,
    alternativas: preparo?.alternativas ?? [],
    faltando: preparo?.faltando ?? [],
    pendencias: preparo?.pendencias ?? [],
  });
}

const Definir = z.object({
  produtoId: z.string().min(1),
  categoriaId: z.string().regex(/^MLB\d+$/, "Código de categoria fora do padrão do Mercado Livre."),
});

/**
 * PUT — o lojista escolhe a categoria.
 *
 * Responde com o preparo recalculado inteiro, e não com um "ok": é o que
 * permite a tela dizer *"categoria definida ✓, ainda faltam marca e GTIN"* na
 * mesma resposta. Descobrir o que falta tentando publicar é o que esta tela
 * existe para evitar.
 */
export async function PUT(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const entrada = Definir.safeParse(await request.json().catch(() => null));
  if (!entrada.success) {
    return Response.json({ erro: entrada.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  try {
    const { preparo, categoria } = await definirCategoriaManual(
      s.tenant.id,
      entrada.data.produtoId,
      entrada.data.categoriaId,
    );
    return Response.json({
      categoria,
      estado: preparo.estado,
      faltando: preparo.faltando,
      pendencias: preparo.pendencias,
    });
  } catch (e) {
    if (e instanceof ProdutoNaoEncontrado) return Response.json({ erro: e.message }, { status: 404 });
    if (e instanceof CategoriaInvalida) return Response.json({ erro: e.message }, { status: 422 });
    // Falha de rede não apaga nada: a gravação só acontece depois da consulta.
    return Response.json(
      { erro: "Não consegui falar com o Mercado Livre agora. A categoria anterior continua valendo; tente de novo." },
      { status: 502 },
    );
  }
}
