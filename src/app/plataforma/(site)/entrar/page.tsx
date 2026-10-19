import type { Metadata } from "next";
import Link from "next/link";
import { configSSO, RECADOS_SSO } from "@/lib/sso";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

/** Entrada exclusivamente via Auth. Nunca faz login automático ao visitar /entrar. */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  const { sso } = await searchParams;
  const recado = sso ? RECADOS_SSO[sso] : undefined;
  const cfg = configSSO();
  return <div className="pl-site-claro pl-auth-pagina"><div className="pl-auth-simples">
    <span>Acesso</span><h1>Entre na sua loja.</h1>
    <p className="mt-3 text-sm text-neutral-600">O acesso às lojas é feito exclusivamente pela sua conta Ávila Ops.</p>
    {recado && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{recado}</p>}
    {cfg ? <div className="mt-6 grid gap-3">
      <a href="/api/painel/entrar/iniciar-sso" className="btn-primario w-full justify-center">Entrar com a conta Ávila Ops</a>
      <form action={`${cfg.url}/api/auth/logout`} method="post">
        <button type="submit" className="w-full min-h-11 rounded-lg border border-neutral-300 text-sm">Trocar de conta Ávila Ops</button>
      </form>
      <p className="text-xs text-neutral-500">Trocar de conta encerra a sessão do Auth em todas as aplicações Ávila Ops neste navegador.</p>
    </div> : <p role="alert" className="mt-6 text-sm">Autenticação Ávila Ops indisponível. Contate o suporte.</p>}
    <p className="pl-auth-links"><span>Ainda não tem loja? <Link href="/criar">Criar agora</Link></span></p>
  </div></div>;
}
