import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import EntrarForm from "@/components/painel/EntrarForm";

export const metadata: Metadata = {
  title: "Entrar | Lojas by Avila Ops",
  robots: { index: false, follow: false },
};

const PILARES = [
  ["01", "Marca consistente"],
  ["02", "Vitrine em evolução"],
  ["03", "Operação organizada"],
] as const;

export default async function EntrarPage() {
  const lojista = await lojistaAtual();
  if (lojista) redirect("/painel");

  return (
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
        <h2>Bem-vindo de volta.</h2>
        <p>Acesse o estúdio para cuidar da sua marca, do catálogo, dos pedidos e da operação.</p>
        <div className="mt-7"><EntrarForm /></div>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/recuperar" className="underline">Esqueci a senha</Link>
          {" · "}Ainda não tem loja?{" "}
          <Link href="/criar" className="underline">Criar agora</Link>
        </p>
      </section>
    </div>
  );
}
