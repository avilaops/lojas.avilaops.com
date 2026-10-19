import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { identificarPorEmail } from "@/lib/operadores";
import { entradaEquipeFoiIniciada } from "@/lib/entrada-equipe";
import { abrirSessao } from "@/lib/sessao";
import { COOKIE_SSO, configSSO, consultarSSO, destinoDaEntradaSSO, podeEntrarComoEquipe, urlDeLoginSSO } from "@/lib/sso";
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

  if (!(await entradaEquipeFoiIniciada())) redirect("/entrar?senha=1");
  const jaVoltou = new URL(request.url).searchParams.get("volta") === "1";
  const token = (await cookies()).get(COOKIE_SSO)?.value;
  const r = await consultarSSO(cfg, token);

  const quem = r.tipo === "ok" ? await identificarPorEmail(r.email) : null;
  const destino = destinoDaEntradaSSO(r, {
    temLoja: !!quem,
    equipe: !quem && podeEntrarComoEquipe(r),
    jaVoltou,
    urlLogin: urlDeLoginSSO(cfg, base),
  });
  // Sem loja com este e-mail, `/criar/sso` pergunta antes de criar. Nunca cria
  // sozinho: o cookie do login único chega de qualquer sistema da Avila Ops.
  if (destino !== "abrir" || !quem) redirect(destino === "abrir" ? "/entrar?sso=indisponivel" : destino);

  await abrirSessao(quem.tenant.slug, quem.operador?.id, { equipe: podeEntrarComoEquipe(r) });
  redirect("/painel");
}
