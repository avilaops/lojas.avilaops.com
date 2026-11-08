import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { configSSO, RECADOS_SSO } from "@/lib/sso";
import { configOIDC } from "@/lib/oidc";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

/** Redireciona imediatamente para o SSO. Erros ficam aqui para evitar loops. */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  const { sso } = await searchParams;
  const cfg = configSSO();
  const base = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
  const localSemOIDC = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(base) && !configOIDC();
  if (cfg && !sso && !localSemOIDC) redirect("/api/painel/entrar/iniciar-sso");

  const saiu = sso === "saiu";
  const recado = localSemOIDC ? "O login deste ambiente ainda não está conectado ao Auth. Conclua o cadastro da integração local para entrar com sua conta Ávila Ops." : saiu ? "Sessão do Lojas encerrada." : sso ? RECADOS_SSO[sso] ?? "Não foi possível concluir o acesso." : "Autenticação Ávila Ops indisponível. Contate o suporte.";
  return <main className="pl-site-claro pl-auth-pagina"><div className="pl-auth-simples">
    <span>Acesso Ávila Ops</span><h1>{localSemOIDC ? "Conecte o login deste ambiente." : saiu ? "Você saiu do Lojas." : "Não foi possível entrar."}</h1>
    <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{recado}</p>
    {localSemOIDC && <a href="https://auth.avilaops.com/admin/integracoes" className="btn-primario mt-6 inline-flex min-h-11 items-center justify-center">Configurar no Auth</a>}
    {cfg && !localSemOIDC && <div className="mt-6 grid gap-3">
      <a href="/api/painel/entrar/iniciar-sso" className="btn-primario w-full justify-center">Tentar novamente</a>
      <form action={`${cfg.url}/api/auth/logout`} method="post">
        <button type="submit" className="min-h-11 w-full rounded-lg border border-neutral-300 text-sm">Encerrar sessão Ávila Ops para trocar de conta</button>
      </form>
    </div>}
  </div></main>;
}
