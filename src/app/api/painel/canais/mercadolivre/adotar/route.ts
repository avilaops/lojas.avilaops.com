import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { conectado } from "@/lib/mercadolivre";
import { AdocaoRecusada, listarParaAdotar, vincularAnuncios } from "@/lib/mercadolivre-adocao";

/**
 * Os anúncios que o lojista já tem no Mercado Livre.
 *
 * GET propõe (o que casou, por quê, e o que mudaria); POST liga o que ele
 * escolheu. A separação é o ponto: vincular entrega o preço e o estoque da
 * loja ao anúncio, e isso é decisão de quem vende, não dedução nossa.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  if (!conectado(s.tenant)) {
    return Response.json({ erro: "Conecte a conta do Mercado Livre primeiro." }, { status: 409 });
  }

  const limite = Number(new URL(request.url).searchParams.get("limite") ?? 100);
  try {
    return Response.json(await listarParaAdotar(s.tenant, { limite: Number.isFinite(limite) ? limite : 100 }));
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Não consegui ler seus anúncios no Mercado Livre." },
      { status: 502 },
    );
  }
}

const Vincular = z.object({
  pares: z
    .array(
      z.object({
        mlbId: z.string().regex(/^MLB\d+$/, "Código de anúncio fora do padrão."),
        produtoId: z.string().min(1),
        categoriaMl: z.string().regex(/^MLB\d+$/).nullish(),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const entrada = Vincular.safeParse(await request.json().catch(() => null));
  if (!entrada.success) {
    return Response.json({ erro: entrada.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  // Um anúncio não pode ser ligado a dois produtos na mesma leva: `mlbId` é
  // único, então o segundo apagaria o primeiro em silêncio.
  const mlbs = entrada.data.pares.map((p) => p.mlbId);
  if (new Set(mlbs).size !== mlbs.length) {
    return Response.json({ erro: "O mesmo anúncio aparece duas vezes na seleção." }, { status: 422 });
  }

  // O mesmo vale do outro lado: `(tenantId, produtoId)` é único.
  const produtos = entrada.data.pares.map((p) => p.produtoId);
  if (new Set(produtos).size !== produtos.length) {
    return Response.json({ erro: "O mesmo produto aparece duas vezes na seleção." }, { status: 422 });
  }

  // `mlbId` é único globalmente: um anúncio já ligado a outro produto desta
  // loja precisa ser desfeito lá antes, e não sobrescrito aqui.
  const jaLigados = await prisma.anuncioMercadoLivre.findMany({
    where: { mlbId: { in: mlbs } },
    select: { mlbId: true, tenantId: true },
  });
  if (jaLigados.length) {
    const meus = jaLigados.filter((a) => a.tenantId === s.tenant.id).map((a) => a.mlbId);
    return Response.json(
      {
        erro: meus.length
          ? `O anúncio ${meus[0]} já está ligado a um produto desta loja.`
          : "Um dos anúncios já está vinculado em outra loja da plataforma.",
      },
      { status: 409 },
    );
  }

  try {
    return Response.json(await vincularAnuncios(s.tenant.id, entrada.data.pares));
  } catch (e) {
    if (e instanceof AdocaoRecusada) return Response.json({ erro: e.message }, { status: 409 });
    return Response.json({ erro: "Não consegui vincular agora. Tente de novo." }, { status: 500 });
  }
}
