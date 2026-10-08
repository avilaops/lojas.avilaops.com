import { redirect } from "next/navigation";
import { sessaoDoPainel } from "@/lib/sessao";
import { exigir, permite } from "@/lib/operadores";
import { aplicativoConfigurado, conectadoPorOAuth, desconectar, urlDeAutorizacao } from "@/lib/mercado-pago-conta";

/**
 * O lojista conecta e desconecta a própria conta do Mercado Pago.
 *
 * GET manda para a autorização e DELETE apaga a credencial daqui. O teste da
 * conexão é o mesmo das chaves coladas: POST /api/painel/recebimento.
 */
export const dynamic = "force-dynamic";

const DESTINO = "/painel/configuracoes/recebimento";

export async function GET() {
  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  // Balcão não troca a conta onde cai o dinheiro da loja inteira.
  if (!permite(s.papel, "configuracoes")) redirect(`${DESTINO}?mp=sem-permissao`);
  if (!aplicativoConfigurado()) redirect(`${DESTINO}?mp=indisponivel`);

  const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
  // O slug vem da sessão, nunca da URL, e segue assinado no `state`.
  redirect(urlDeAutorizacao(s.tenant.slug, base));
}

/**
 * DELETE apaga a credencial. A loja para de cobrar até conectar de novo.
 *
 * Só desfaz conexão: chave colada à mão se troca salvando outra, e apagá-la por
 * aqui deixaria a loja sem receber por um clique que não era sobre ela.
 */
export async function DELETE() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  if (!conectadoPorOAuth(s.tenant)) return Response.json({ erro: "A loja não está conectada pelo Mercado Pago." }, { status: 409 });
  await desconectar(s.tenant.id);
  return Response.json({ desconectado: true });
}
