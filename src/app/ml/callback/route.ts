import { redirect } from "next/navigation";
import { conectar } from "@/lib/mercadolivre";

/**
 * GET /ml/callback — o lojista volta do Mercado Livre depois de autorizar.
 *
 * A rota é uma só para todas as lojas, porque o ML aceita uma URL de retorno
 * por aplicativo. Quem diz de qual loja é a autorização é o `state`, que leva o
 * slug: sem ele, o token do lojista da Fênix poderia ser gravado na Vedashow.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const code = p.get("code");
  const slug = p.get("state");
  const erro = p.get("error");
  const destino = "/painel/configuracoes/canais";

  // O lojista clicou em "não autorizo": não é falha, é decisão dele.
  if (erro) redirect(`${destino}?ml=recusado`);
  if (!code || !slug) redirect(`${destino}?ml=incompleto`);

  try {
    const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
    await conectar(slug, code, base);
  } catch {
    // A mensagem do ML não vai para a URL: ela pode carregar detalhe do token.
    redirect(`${destino}?ml=falhou`);
  }
  redirect(`${destino}?ml=conectado`);
}
