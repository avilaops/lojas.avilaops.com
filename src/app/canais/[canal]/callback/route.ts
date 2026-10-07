import { redirect } from "next/navigation";
import { conectar, propositoDoState, provedorDo } from "@/lib/contas-canal";
import { lerState } from "@/lib/oauth-state";
import { permite } from "@/lib/operadores";
import { sessaoDoPainel } from "@/lib/sessao";

/**
 * GET /canais/<canal>/callback — o lojista volta da Amazon, da Shopee ou do
 * Magalu depois de autorizar.
 *
 * A rota é uma só por canal para todas as lojas, porque cada aplicativo aceita
 * uma URL de retorno. Quem diz de qual loja é a autorização é o `state`, e ele
 * precisa bater duas vezes: com a assinatura que nós emitimos e com a sessão de
 * quem está voltando. Sem isso, um endereço montado à mão gravaria a conta de
 * um lojista na loja de outro.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const { canal } = await params;
  const provedor = provedorDo(canal);
  if (!provedor) return Response.json({ erro: "canal desconhecido" }, { status: 404 });

  const p = new URL(request.url).searchParams;
  const destino = `/painel/configuracoes/canais?canal=${provedor.canal}`;

  // O lojista clicou em "não autorizo": não é falha, é decisão dele.
  if (provedor.recusou(p)) redirect(`${destino}&r=recusado`);

  const slug = lerState(propositoDoState(provedor.canal), p.get("state"));
  if (!slug) redirect(`${destino}&r=incompleto`);

  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  if (s.tenant.slug !== slug || !permite(s.papel, "configuracoes")) redirect(`${destino}&r=incompleto`);

  try {
    const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
    await conectar(s.tenant.id, provedor.canal, p, base);
  } catch (erro) {
    // A mensagem do canal não vai para a URL: ela pode carregar detalhe do token.
    console.error(`[canais] conexão com ${provedor.canal} falhou na loja ${slug}:`, erro instanceof Error ? erro.message : erro);
    redirect(`${destino}&r=falhou`);
  }
  redirect(`${destino}&r=conectado`);
}
