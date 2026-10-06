import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import { CAMINHO_RETORNO, configSSO, RECADOS_SSO } from "@/lib/sso";
import EntrarForm from "@/components/painel/EntrarForm";
import BotaoGoogle from "@/components/painel/BotaoGoogle";
import { googleConfigurado } from "@/lib/google-entrada";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

/**
 * Só o login. Quem chega aqui já decidiu entrar: o painel de apresentação ao
 * lado do formulário empurrava os campos para baixo da dobra no celular.
 *
 * Com o login único ligado (`SSO_APP_ID`), a conta Avila Ops vem primeiro; o
 * Google (`GOOGLE_CLIENT_ID`) vem logo abaixo; e-mail e senha da loja ficam por
 * último. Cada porta só aparece quando está configurada.
 */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ sso?: string; google?: string }> }) {
  const lojista = await lojistaAtual();
  if (lojista) redirect("/painel");

  const { sso, google } = await searchParams;
  const recado = sso ? RECADOS_SSO[sso] : undefined;
  const loginUnico = configSSO() !== null;
  const comGoogle = googleConfigurado();

  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Acesso</span>
        <h1>Entre na sua loja.</h1>
        {recado && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{recado}</p>}
        {google === "falhou" && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.</p>
        )}
        {(loginUnico || comGoogle) && (
          <div className="mt-6 grid gap-4">
            {/* `<a>` e não `<Link>`: é uma rota de API que responde com redirecionamento
                para outro domínio, e o roteador do cliente não navega para isso. */}
            {loginUnico && <a href={CAMINHO_RETORNO} className="btn-primario w-full justify-center">Entrar com a conta Avila Ops</a>}
            {comGoogle && <BotaoGoogle rotulo="Entrar com Google" />}
            <p className="pl-divisor"><span>ou com e-mail e senha</span></p>
          </div>
        )}
        <div className="mt-6"><EntrarForm /></div>
        <p className="pl-auth-links">
          <Link href="/recuperar">Esqueci a senha</Link>
          <span>Ainda não tem loja? <Link href="/criar">Criar agora</Link></span>
        </p>
      </div>
    </div>
  );
}
