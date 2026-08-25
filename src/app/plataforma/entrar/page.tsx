import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import EntrarForm from "@/components/painel/EntrarForm";

export const metadata: Metadata = { title: "Entrar — Lojas by Avila Ops", robots: { index: false } };

export default async function EntrarPage() {
  if (await lojistaAtual()) redirect("/painel");
  return (
    <div className="pl-auth pl-container">
      <section className="pl-auth-story">
        <span>Estúdio Lojas</span>
        <h1>A operação da sua marca, em um só lugar.</h1>
        <p>Identidade, catálogo, pedidos e crescimento conectados em uma experiência feita para o seu negócio.</p>
        <div><strong>01</strong><span>Marca consistente</span><strong>02</strong><span>Vitrine em evolução</span><strong>03</strong><span>Operação organizada</span></div>
      </section>
      <section className="pl-auth-form">
        <span>Acesso seguro</span>
        <h2>Bem-vindo de volta.</h2>
        <p>Entre com os dados definidos no lançamento da loja.</p>
        <div className="mt-7"><EntrarForm /></div>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/recuperar" className="underline">Esqueci a senha</Link> · Ainda não tem loja? <Link href="/criar" className="underline">Criar agora</Link>
        </p>
      </section>
    </div>
  );
}
