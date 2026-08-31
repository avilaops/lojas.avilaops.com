import type { Metadata } from "next";
import RecuperarForm from "@/components/painel/RecuperarForm";

export const metadata: Metadata = { title: "Nova senha | Lojas by Avila Ops", robots: { index: false } };

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="container-loja max-w-sm py-16">
      <h1 className="text-2xl font-bold">Definir nova senha</h1>
      <div className="mt-6"><RecuperarForm modo="trocar" token={token ?? ""} /></div>
    </div>
  );
}
