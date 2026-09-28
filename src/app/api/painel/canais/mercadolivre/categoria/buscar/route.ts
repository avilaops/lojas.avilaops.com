import { exigir } from "@/lib/operadores";
import { buscarCategorias, detalharCategoria } from "@/lib/mercadolivre-categorias";

/**
 * GET ?q= para procurar, ?id= para descer pelas filhas.
 *
 * Endpoint público do Mercado Livre dos dois lados: a tela funciona com a conta
 * desconectada, que é o ponto — o lojista arruma o catálogo antes de autorizar
 * a venda, e não o contrário.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { erro } = await exigir("configuracoes");
  if (erro) return erro;

  const p = new URL(request.url).searchParams;
  const id = p.get("id");

  try {
    if (id) {
      const categoria = await detalharCategoria(id);
      return categoria
        ? Response.json({ categorias: [categoria] })
        : Response.json({ erro: "O Mercado Livre não reconhece essa categoria." }, { status: 404 });
    }
    return Response.json({ categorias: await buscarCategorias(p.get("q") ?? "") });
  } catch {
    return Response.json({ erro: "Não consegui falar com o Mercado Livre agora. Tente de novo." }, { status: 502 });
  }
}
