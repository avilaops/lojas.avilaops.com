import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { configSSO, RECADOS_SSO } from "@/lib/sso";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

/** Redireciona imediatamente para o SSO. Erros ficam aqui para evitar loops. */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  const { sso } = await searchParams;
  const cfg = configSSO();
  if (cfg && !sso) redirect("/api/painel/entrar/iniciar-sso");

  const recado = sso ? RECADOS_SSO[sso] ?? "Não foi possível concluir o acesso." : "Autenticação Ávila Ops indisponível. Contate o suporte.";
  return <main className="pl-site-claro pl-auth-pagina"><div className="pl-auth-simples">
    <span>Acesso Ávila Ops</span><h1>Não foi possível entrar.</h1>
    <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{recado}</p>
    {cfg && <div className="mt-6 grid gap-3">
      <a href="/api/painel/entrar/iniciar-sso" className="btn-primario w-full justify-center">Tentar novamente</a>
      <form action={`${cfg.url}/api/auth/logout`} method="post">
        <button type="submit" className="min-h-11 w-full rounded-lg border border-neutral-300 text-sm">Entrar com outra conta Ávila Ops</button>
      </form>
    </div>}
  </div></main>;
}
