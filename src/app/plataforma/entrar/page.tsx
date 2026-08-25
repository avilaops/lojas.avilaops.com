import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import EntrarForm from "@/components/painel/EntrarForm";

export const metadata: Metadata = { title: "Entrar — Lojas by Avila Ops", robots: { index: false } };

export default async function EntrarPage() {
  if (await lojistaAtual()) redirect("/painel");
  return (
    <div className="container-loja max-w-sm py-16">
      <h1 className="text-2xl font-bold">Entrar no painel</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use o e-mail e a senha que você definiu ao criar a loja.</p>
      <div className="mt-6">
        <EntrarForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/recuperar" className="underline">Esqueci a senha</Link> · Ainda não tem loja? <Link href="/criar" className="underline">Criar agora</Link>
      </p>
    </div>
  );
}
