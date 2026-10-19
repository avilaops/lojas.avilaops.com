import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { identificarPorEmail } from "@/lib/operadores";
import { lojasAutorizadas } from "@/lib/acessos-loja";
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

  if (!(await entradaEquipeFoiIniciada())) redirect("/entrar");
  const jaVoltou = new URL(request.url).searchParams.get("volta") === "1";
  const token = (await cookies()).get(COOKIE_SSO)?.value;
  const r = await consultarSSO(cfg, token);

  const lojas = r.tipo === "ok" ? await lojasAutorizadas(r.email) : [];
  const quem = r.tipo === "ok" && lojas.length === 0 ? await identificarPorEmail(r.email) : null;
  // A conta com várias lojas escolhe explicitamente o tenant antes da sessão.
  if (r.tipo === "ok" && lojas.length > 1 && !podeEntrarComoEquipe(r)) redirect("/entrar/lojas");
  const destino = destinoDaEntradaSSO(r, {
    temLoja: !!quem || lojas.length === 1,
    equipe: !quem && podeEntrarComoEquipe(r),
    jaVoltou,
    urlLogin: urlDeLoginSSO(cfg, base),
  });
  // Sem loja com este e-mail, `/criar/sso` pergunta antes de criar. Nunca cria
  // sozinho: o cookie do login único chega de qualquer sistema da Avila Ops.
  if (destino !== "abrir" || (!quem && lojas.length !== 1)) redirect(destino === "abrir" ? "/entrar?sso=indisponivel" : destino);

  const loja = lojas[0];
  await abrirSessao(loja?.slug ?? quem!.tenant.slug, loja ? null : quem?.operador?.id, {
    equipe: podeEntrarComoEquipe(r), identidadeEmail: loja ? r.tipo === "ok" ? r.email : undefined : undefined,
  });
  redirect("/painel");
}
