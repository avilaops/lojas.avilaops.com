import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { identificarPorEmail } from "@/lib/operadores";
import { abrirSessao } from "@/lib/sessao";
import { COOKIE_SSO, configSSO, consultarSSO, urlDeLoginSSO } from "@/lib/sso";
import { normalizarHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Entrada no painel pelo login único da Avila Ops.
 *
 * O caminho inteiro: sem sessão no Auth, a pessoa vai ao `/login` de lá e
 * volta para cá; com sessão, o Auth diz quem é e se pode entrar no Lojas; o
 * e-mail é procurado entre os donos e as equipes das lojas; e a sessão aberta
 * é a mesma `lojas_sessao` do login por senha.
 *
 * Só existe no endereço da plataforma. O cookie do Auth chega também nos
 * subdomínios das lojas (`<slug>.lojas.avilaops.com`), e lá esta rota não tem
 * o que fazer: o painel não mora na vitrine.
 */
export async function GET(request: Request) {
  const cfg = configSSO();
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const host = normalizarHost((await headers()).get("host"));
  if (!cfg || host !== base) return new Response(null, { status: 404 });

  const jaVoltou = new URL(request.url).searchParams.get("volta") === "1";
  const token = (await cookies()).get(COOKIE_SSO)?.value;
  const r = await consultarSSO(cfg, token);

  if (r.tipo === "sem_sessao") redirect(jaVoltou ? "/entrar?sso=indisponivel" : urlDeLoginSSO(cfg, base));
  if (r.tipo === "indisponivel") redirect("/entrar?sso=indisponivel");
  if (r.tipo === "sem_acesso") redirect("/entrar?sso=sem-acesso");

  const quem = await identificarPorEmail(r.email);
  if (!quem) redirect("/entrar?sso=sem-loja");

  await abrirSessao(quem.tenant.slug, quem.operador?.id);
  redirect("/painel");
}
