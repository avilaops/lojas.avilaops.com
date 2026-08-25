import type { Metadata } from "next";
import RecuperarForm from "@/components/painel/RecuperarForm";

export const metadata: Metadata = { title: "Recuperar senha — Lojas by Avila Ops", robots: { index: false } };

export default function RecuperarPage() {
  return (
    <div className="container-loja max-w-sm py-16">
      <h1 className="text-2xl font-bold">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">Informe o e-mail da loja. Enviamos um link válido por 1 hora.</p>
      <div className="mt-6"><RecuperarForm modo="pedir" /></div>
    </div>
  );
}
