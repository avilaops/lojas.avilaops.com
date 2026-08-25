import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import CriarLoja from "@/components/painel/CriarLoja";

export const metadata: Metadata = { title: "Criar minha loja — Lojas by Avila Ops", robots: { index: false } };

export default async function CriarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  if (await lojistaAtual()) redirect("/painel");
  const { plano } = await searchParams;
  return (
    <div className="container-loja pl-workspace max-w-4xl py-10">
      <header className="pl-workspace-heading mb-8">
        <span>Estúdio de lançamento</span>
        <h1>Construa uma loja com identidade própria.</h1>
        <p>Em cinco etapas, transformamos a essência do negócio em direção visual, vitrine e presença digital. Sua loja entra no ar ao final.</p>
      </header>
      <CriarLoja planoInicial={plano === "SITE" || plano === "LOJA_PRO" ? plano : "LOJA"} />
    </div>
  );
}
