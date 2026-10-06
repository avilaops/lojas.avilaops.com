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

const PILARES = [
  ["01", "Marca consistente"],
  ["02", "Vitrine em evolução"],
  ["03", "Operação organizada"],
] as const;

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ sso?: string; google?: string }> }) {
  const lojista = await lojistaAtual();
  if (lojista) redirect("/painel");

  const { sso, google } = await searchParams;
  const recado = sso ? RECADOS_SSO[sso] : undefined;
  const loginUnico = configSSO() !== null;

  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth pl-container">
        <section className="pl-auth-story">
          <span>Estúdio Lojas</span>
          <h1>A operação da sua marca, em um só lugar.</h1>
          <p>Identidade, catálogo, pedidos e crescimento conectados em uma experiência feita para o seu negócio.</p>
          <ol>
            {PILARES.map(([numero, titulo]) => (
              <li key={numero}>
                <strong>{numero}</strong>
                <span>{titulo}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="pl-auth-form">
          <span>Acesso seguro</span>
          <h2>Entre na sua loja.</h2>
          <p>Acesse o estúdio para cuidar da sua marca, do catálogo, dos pedidos e da operação.</p>
          {recado && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{recado}</p>}
          {google === "falhou" && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.</p>
          )}
          {googleConfigurado() && (
            <div className="mt-7 grid gap-4">
              <BotaoGoogle rotulo="Entrar com Google" />
              <p className="pl-divisor"><span>ou com e-mail e senha</span></p>
            </div>
          )}
          <div className="mt-7"><EntrarForm /></div>
          {loginUnico && (
            // `<a>` e não `<Link>`: é uma rota de API que responde com redirecionamento
            // para outro domínio, e o roteador do cliente não navega para isso.
            <a href={CAMINHO_RETORNO} className="btn-secundario mt-3 w-full justify-center">Entrar com a conta Avila Ops</a>
          )}
          <p className="pl-auth-links">
            <Link href="/recuperar">Esqueci a senha</Link>
            <span>Ainda não tem loja? <Link href="/criar">Criar agora</Link></span>
          </p>
        </section>
      </div>
    </div>
  );
}
