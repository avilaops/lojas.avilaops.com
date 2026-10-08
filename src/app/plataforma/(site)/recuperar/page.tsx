import type { Metadata } from "next";
import Link from "next/link";
import RecuperarForm from "@/components/painel/RecuperarForm";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function RecuperarPage() {
  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Acesso</span>
        <h1>Recuperar senha</h1>
        <p>Informe o e-mail da loja. Enviamos um link válido por 1 hora.</p>
        <div className="mt-6"><RecuperarForm modo="pedir" /></div>
        <p className="pl-auth-links"><Link href="/entrar?senha=1">Voltar para o login</Link></p>
      </div>
    </div>
  );
}
