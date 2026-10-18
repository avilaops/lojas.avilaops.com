import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { abrirSessao } from "@/lib/sessao";
import { CAMINHO_DA_EQUIPE, COOKIE_SSO, configSSO, consultarSSO, podeEntrarComoEquipe } from "@/lib/sso";
import { normalizarHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Redireciona depois do envio do formulário (303: o navegador volta com GET). */
function para(caminho: string): Response {
  return new Response(null, { status: 303, headers: { location: caminho } });
}

/**
 * A equipe da Avila Ops entra na loja escolhida em `/entrar/equipe`.
 *
 * Nada do que vem do formulário é confiado além do `slug`: quem é a pessoa e se
 * ela é da casa o Auth responde de novo aqui, na hora de abrir a sessão. A tela
 * de escolha é só a lista; a porta é esta rota.
 *
 * A sessão aberta é a do dono (o token do painel só conhece dono e operador).
 * Por isso a entrada é gravada no log com o e-mail de quem entrou: dentro do
 * painel, o que essa pessoa fizer aparece como feito pelo dono.
 *
 * Só no endereço da plataforma e só vindo dele: um formulário de outro site
 * não abre sessão em nome de quem está logado no Auth.
 */
export async function POST(request: Request) {
  const cfg = configSSO();
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const h = await headers();
  if (!cfg || normalizarHost(h.get("host")) !== base) return new Response(null, { status: 404 });

  const origem = h.get("origin");
  if (!origem || normalizarHost(origem.replace(/^https?:\/\//, "")) !== base) return new Response(null, { status: 403 });

  const r = await consultarSSO(cfg, (await cookies()).get(COOKIE_SSO)?.value);
  if (!podeEntrarComoEquipe(r)) return para("/entrar?sso=sem-loja");

  const slug = String((await request.formData().catch(() => null))?.get("slug") ?? "");
  const loja = /^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)
    ? await prisma.tenant.findUnique({ where: { slug }, select: { slug: true, status: true } })
    : null;
  if (!loja || loja.status === "CANCELADA") return para(CAMINHO_DA_EQUIPE);

  await abrirSessao(loja.slug, null, { equipe: true });
  console.log(JSON.stringify({ evento: "equipe.entrou-na-loja", loja: loja.slug, email: r.email, em: new Date().toISOString() }));
  return para("/painel");
}
