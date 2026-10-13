import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { identificarPorEmail } from "@/lib/operadores";
import { lojistaAtual } from "@/lib/sessao";
import { CAMINHO_RETORNO, COOKIE_SSO, configSSO, consultarSSO } from "@/lib/sso";
import { emitirSelo } from "@/lib/sso-cadastro";
import { DIAS_DE_TESTE } from "@/lib/planos";

export const metadata: Metadata = { title: "Criar loja com a conta Avila Ops", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Quem entrou pelo login único e não tem loja chega aqui, e não a um recado de
 * "sem loja". A loja só nasce no clique; a página nunca cria nada sozinha.
 */
export default async function CriarPeloSSOPage() {
  if (await lojistaAtual()) redirect("/painel");
  const cfg = configSSO();
  if (!cfg) redirect("/criar");

  const r = await consultarSSO(cfg, (await cookies()).get(COOKIE_SSO)?.value);
  if (r.tipo === "sem_sessao") redirect(CAMINHO_RETORNO);
  if (r.tipo === "sem_email") redirect("/entrar?sso=sem-email");
  if (r.tipo === "sem_acesso") redirect("/entrar?sso=sem-acesso");
  if (r.tipo === "indisponivel") redirect("/entrar?sso=indisponivel");
  if (await identificarPorEmail(r.email)) redirect(CAMINHO_RETORNO);

  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Criar loja</span>
        <h1>Criar sua loja com {r.email}?</h1>
        <p>Você entrou com a conta Avila Ops, e ainda não há loja com este e-mail. Confirmando, a loja nasce agora; o nome e o plano você escolhe lá dentro. São {DIAS_DE_TESTE} dias grátis, sem cartão. Você volta a entrar sempre pelo mesmo botão “Entrar com a conta Avila Ops”, sem precisar de senha.</p>
        <form method="post" action="/api/painel/entrar/sso/criar" className="mt-6">
          <input type="hidden" name="selo" value={emitirSelo(r.email)} />
          <button type="submit" className="btn-primario w-full justify-center">Criar minha loja</button>
        </form>
        <p role="note" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Já tem uma loja com outro e-mail? Não crie outra: <Link href="/entrar?senha=1">entre com o e-mail e a senha da loja</Link>, ou entre de novo no login da Avila Ops com a conta que usa esse e-mail.
        </p>
      </div>
    </div>
  );
}
