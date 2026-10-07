import { redirect } from "next/navigation";
import { desconectar, propositoDoState, provedorDo, urlDeRetorno } from "@/lib/contas-canal";
import { emitirState } from "@/lib/oauth-state";
import { exigir, permite } from "@/lib/operadores";
import { sessaoDoPainel } from "@/lib/sessao";

/**
 * O lojista conecta e desconecta a própria conta na Amazon, na Shopee ou no
 * Magalu. O Mercado Livre tem rota própria, ao lado desta.
 *
 * GET manda para a autorização; DELETE apaga a credencial daqui.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ canal: string }> };

const DESTINO = "/painel/configuracoes/canais";

export async function GET(_request: Request, { params }: Ctx) {
  const { canal } = await params;
  const provedor = provedorDo(canal);
  if (!provedor) return Response.json({ erro: "canal desconhecido" }, { status: 404 });

  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  // Balcão não troca a conta em que a loja inteira vende.
  if (!permite(s.papel, "configuracoes")) redirect(`${DESTINO}?canal=${provedor.canal}&r=sem-permissao`);
  if (!provedor.configurado()) redirect(`${DESTINO}?canal=${provedor.canal}&r=indisponivel`);

  const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
  // O slug vem da sessão, nunca da URL, e segue assinado no `state`.
  const state = emitirState(propositoDoState(provedor.canal), s.tenant.slug);
  redirect(provedor.urlDeAutorizacao(state, urlDeRetorno(provedor.canal, base)));
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { canal } = await params;
  const provedor = provedorDo(canal);
  if (!provedor) return Response.json({ erro: "canal desconhecido" }, { status: 404 });

  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  await desconectar(s.tenant.id, provedor.canal);
  return Response.json({ desconectado: true });
}
