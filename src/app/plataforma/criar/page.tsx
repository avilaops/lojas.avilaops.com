import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import CriarLoja from "@/components/painel/CriarLoja";

export const metadata: Metadata = { title: "Criar minha loja — Lojas by Avila Ops", robots: { index: false } };

export default async function CriarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  if (await lojistaAtual()) redirect("/painel");
  const { plano } = await searchParams;
  return (
    <div className="container-loja max-w-3xl py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Criar minha loja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quatro passos. A loja fica no ar no final, no endereço provisório; o domínio próprio a gente configura depois.</p>
      </header>
      <CriarLoja planoInicial={plano === "SITE" || plano === "LOJA_PRO" ? plano : "LOJA"} />
    </div>
  );
}
