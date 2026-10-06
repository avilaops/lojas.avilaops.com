import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lerTokenDeCadastro } from "@/lib/cadastro";
import { lojistaAtual } from "@/lib/sessao";
import ConfirmarForm from "@/components/painel/ConfirmarForm";

export const metadata: Metadata = { title: "Criar senha", robots: { index: false, follow: false } };

export default async function ConfirmarPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (await lojistaAtual()) redirect("/painel");
  const { token = "" } = await searchParams;
  const lido = lerTokenDeCadastro(token);
  // Conferir antes de mostrar o formulário: quem abre um link vencido não pode
  // descobrir isso só depois de digitar a senha duas vezes.
  const jaTemConta = "email" in lido && Boolean(await prisma.tenant.findUnique({ where: { loginEmail: lido.email }, select: { id: true } }));

  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Criar conta</span>
        {"erro" in lido ? (
          <>
            <h1>{lido.erro === "expirado" ? "Este link venceu." : "Link inválido."}</h1>
            <p>{lido.erro === "expirado" ? "O link de confirmação vale por 24 horas." : "O endereço pode ter sido copiado pela metade."} Peça outro, leva um minuto.</p>
            <p className="pl-auth-links"><Link href="/criar">Receber um link novo</Link></p>
          </>
        ) : jaTemConta ? (
          <>
            <h1>Esta conta já existe.</h1>
            <p>O e-mail <b>{lido.email}</b> já foi confirmado. Entre com a sua senha.</p>
            <p className="pl-auth-links"><Link href="/entrar">Entrar</Link><Link href="/recuperar">Esqueci a senha</Link></p>
          </>
        ) : (
          <>
            <h1>Crie a sua senha.</h1>
            <p>E-mail confirmado: <b>{lido.email}</b>. Escolha a senha e você já entra no painel da sua loja.</p>
            <div className="mt-6"><ConfirmarForm token={token} /></div>
          </>
        )}
      </div>
    </div>
  );
}
