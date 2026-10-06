import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import { googleConfigurado } from "@/lib/google-entrada";
import { DIAS_DE_TESTE } from "@/lib/planos";
import CadastroForm from "@/components/painel/CadastroForm";

export const metadata: Metadata = { title: "Criar minha loja", robots: { index: false } };

/**
 * A conta vem primeiro: aqui só o e-mail (ou o Google). Nome da loja, WhatsApp
 * e plano ficam para dentro do painel, onde a pessoa já está segura de que o
 * cadastro existe — antes, um formulário de cinco etapas pedia tudo de uma vez
 * a quem ainda nem tinha conta.
 */
export default async function CriarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  if (await lojistaAtual()) redirect("/painel");
  const { plano } = await searchParams;
  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Criar loja</span>
        <h1>Comece pela sua conta.</h1>
        <p>Informe o seu e-mail. Enviamos um link para confirmar e criar a senha; o nome da loja e o plano você escolhe lá dentro. São {DIAS_DE_TESTE} dias grátis, sem cartão.</p>
        <div className="mt-6"><CadastroForm google={googleConfigurado()} plano={plano} /></div>
        <p className="pl-auth-links">
          <span>Já tem conta? <Link href="/entrar">Entrar</Link></span>
        </p>
      </div>
    </div>
  );
}
