import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoDoPainel } from "@/lib/sessao";
import { exigir, permite } from "@/lib/operadores";
import { urlDeAutorizacao } from "@/lib/mercadolivre";

/**
 * O lojista conecta e desconecta a própria conta do Mercado Livre.
 *
 * GET manda para a autorização; DELETE apaga a credencial daqui.
 *
 * O `state` leva o slug da sessão, não o que vier na URL, e segue assinado: o
 * callback é uma rota só para todas as lojas, e sem isso alguém poderia forjar
 * um endereço que grava o token da própria conta na loja de outro lojista.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  // Balcão não troca a conta em que a loja inteira vende.
  if (!permite(s.papel, "configuracoes")) redirect("/painel/configuracoes/canais?ml=sem-permissao");

  const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
  redirect(urlDeAutorizacao(s.tenant.slug, base));
}

/**
 * DELETE apaga a credencial, e só ela.
 *
 * O anúncio continua no ar no Mercado Livre, porque ele é do lojista e não
 * nosso: derrubar anúncio de quem só quis desconectar seria tomar decisão
 * comercial no lugar dele. O espelho fica, para reconectar sem republicar tudo.
 */
export async function DELETE() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  await prisma.tenant.update({
    where: { id: loja.id },
    data: {
      mlAccessTokenEnc: null,
      mlRefreshTokenEnc: null,
      mlExpiraEm: null,
      mlConectadoEm: null,
    },
  });

  return Response.json({ desconectado: true });
}
