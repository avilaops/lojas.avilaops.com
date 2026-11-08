import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { entradaEquipeFoiIniciada } from "@/lib/entrada-equipe";
import { CAMINHO_RETORNO, COOKIE_SSO, configSSO, consultarSSO, podeEntrarComoEquipe } from "@/lib/sso";
import { ShieldCheck } from "lucide-react";
import SeletorLojasEquipe from "@/components/plataforma/SeletorLojasEquipe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar como equipe", robots: { index: false, follow: false } };

/**
 * Entrada da equipe da Avila Ops: a lista de lojas, para escolher em qual entrar.
 *
 * O painel é sempre de uma loja, e a equipe da casa não é dona nem funcionária
 * de nenhuma. Quem chega aqui é conferido de novo no Auth (não basta ter vindo
 * da rota de entrada): a página mostra o nome de todos os clientes.
 *
 * Loja cancelada fica de fora, como no login de qualquer pessoa.
 */
export default async function EntrarComoEquipePage() {
  if (!(await entradaEquipeFoiIniciada())) redirect("/entrar");
  const cfg = configSSO();
  if (!cfg) redirect("/entrar");
  const r = await consultarSSO(cfg, (await cookies()).get(COOKIE_SSO)?.value);
  if (r.tipo === "sem_sessao") redirect(CAMINHO_RETORNO);
  if (!podeEntrarComoEquipe(r)) redirect("/entrar?sso=sem-loja");

  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const lojas = await prisma.tenant.findMany({
    where: { status: { not: "CANCELADA" } },
    select: { slug: true, nome: true, status: true, dominioPrincipal: true },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="eq-conteudo">
      <header className="eq-intro">
        <span className="eq-kicker">Equipe Avila Ops</span>
        <h1>Escolha a loja para continuar.</h1>
        <p>Encontre a loja e entre no painel para continuar o atendimento.</p>
      </header>
      <aside className="eq-identidade" aria-label="Sua identificação de acesso">
        <ShieldCheck size={22} aria-hidden="true" />
        <p><strong>{r.email}</strong><span>Você entra com as permissões do dono. O acesso fica registrado com seu e-mail.</span></p>
      </aside>
      <SeletorLojasEquipe lojas={lojas} base={base} />
    </div>
  );
}
