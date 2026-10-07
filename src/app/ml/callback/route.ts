import { redirect } from "next/navigation";
import { PROPOSITO_DO_STATE, conectar } from "@/lib/mercadolivre";
import { lerState } from "@/lib/oauth-state";
import { permite } from "@/lib/operadores";
import { sessaoDoPainel } from "@/lib/sessao";

/**
 * GET /ml/callback — o lojista volta do Mercado Livre depois de autorizar.
 *
 * A rota é uma só para todas as lojas, porque o ML aceita uma URL de retorno
 * por aplicativo. Quem diz de qual loja é a autorização é o `state`, e ele
 * precisa bater duas vezes: com a assinatura que nós emitimos e com a sessão de
 * quem está voltando. Sem isso, um endereço montado à mão gravaria a conta de
 * um lojista na loja de outro — o token da Fênix na Vedashow.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const code = p.get("code");
  const destino = "/painel/configuracoes/canais";

  // O lojista clicou em "não autorizo": não é falha, é decisão dele.
  if (p.get("error")) redirect(`${destino}?ml=recusado`);

  const slug = lerState(PROPOSITO_DO_STATE, p.get("state"));
  if (!code || !slug) redirect(`${destino}?ml=incompleto`);

  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  if (s.tenant.slug !== slug || !permite(s.papel, "configuracoes")) redirect(`${destino}?ml=incompleto`);

  try {
    const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
    await conectar(slug, code, base);
  } catch (erro) {
    // A mensagem do ML não vai para a URL: ela pode carregar detalhe do token.
    console.error(`[canais] conexão do Mercado Livre falhou na loja ${slug}:`, erro instanceof Error ? erro.message : erro);
    redirect(`${destino}?ml=falhou`);
  }
  redirect(`${destino}?ml=conectado`);
}
