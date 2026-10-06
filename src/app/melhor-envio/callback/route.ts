import { redirect } from "next/navigation";
import { sessaoDoPainel } from "@/lib/sessao";
import { permite } from "@/lib/operadores";
import { conectar, lerState } from "@/lib/melhor-envio-conta";

/**
 * GET /melhor-envio/callback — o lojista volta do Melhor Envio depois de autorizar.
 *
 * A rota é uma só para todas as lojas, porque o aplicativo aceita uma URL de
 * retorno. Quem diz de qual loja é a autorização é o `state`, e ele precisa
 * bater duas vezes: com a assinatura que nós emitimos e com a sessão de quem
 * está voltando. Sem isso, um endereço montado à mão gravaria a conta de um
 * lojista na loja de outro — e o frete de um passaria a ser cotado no contrato
 * do outro.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const code = p.get("code");
  const destino = "/painel/configuracoes/entrega";

  // O lojista clicou em "não autorizo": não é falha, é decisão dele.
  if (p.get("error")) redirect(`${destino}?me=recusado`);

  const slug = lerState(p.get("state"));
  if (!code || !slug) redirect(`${destino}?me=incompleto`);

  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  if (s.tenant.slug !== slug || !permite(s.papel, "configuracoes")) redirect(`${destino}?me=incompleto`);

  try {
    const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
    await conectar(slug, code, base);
  } catch (erro) {
    // A mensagem não vai para a URL: ela pode carregar detalhe do token.
    console.error(`[frete] conexão do Melhor Envio falhou na loja ${slug}:`, erro instanceof Error ? erro.message : erro);
    redirect(`${destino}?me=falhou`);
  }
  redirect(`${destino}?me=conectado`);
}
