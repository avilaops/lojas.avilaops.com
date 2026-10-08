import { redirect } from "next/navigation";
import { sessaoDoPainel } from "@/lib/sessao";
import { permite } from "@/lib/operadores";
import { ContaDeTeste, aplicativoConfigurado, conectar, lerState } from "@/lib/mercado-pago-conta";

/**
 * GET /mercado-pago/callback — o lojista volta do Mercado Pago depois de autorizar.
 *
 * A rota é uma só para todas as lojas, porque o aplicativo aceita uma URL de
 * retorno. Quem diz de qual loja é a autorização é o `state`, e ele precisa
 * bater duas vezes: com a assinatura que nós emitimos e com a sessão de quem
 * está voltando. Sem isso, um endereço montado à mão gravaria a conta de um
 * lojista na loja de outro — e o que essa loja vende cairia na conta errada.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const code = p.get("code");
  const destino = "/painel/configuracoes/recebimento";

  // O lojista clicou em "não autorizo": não é falha, é decisão dele.
  if (p.get("error")) redirect(`${destino}?mp=recusado`);

  const slug = lerState(p.get("state"));
  if (!code || !slug) redirect(`${destino}?mp=incompleto`);

  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  if (s.tenant.slug !== slug || !permite(s.papel, "configuracoes")) redirect(`${destino}?mp=incompleto`);
  if (!aplicativoConfigurado()) redirect(`${destino}?mp=indisponivel`);

  try {
    const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
    await conectar(slug, code, base);
  } catch (erro) {
    // A mensagem não vai para a URL: ela pode carregar detalhe do token.
    console.error(`[recebimento] conexão do Mercado Pago falhou na loja ${slug}:`, erro instanceof Error ? erro.message : erro);
    redirect(`${destino}?mp=${erro instanceof ContaDeTeste ? "teste" : "falhou"}`);
  }
  redirect(`${destino}?mp=conectado`);
}
