import type { Metadata } from "next";
import RecuperarForm from "@/components/painel/RecuperarForm";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Acesso</span>
        <h1>Definir nova senha</h1>
        <div className="mt-6"><RecuperarForm modo="trocar" token={token ?? ""} /></div>
      </div>
    </div>
  );
}
