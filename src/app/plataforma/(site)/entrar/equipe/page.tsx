import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CAMINHO_RETORNO, COOKIE_SSO, configSSO, consultarSSO, podeEntrarComoEquipe } from "@/lib/sso";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar como equipe", robots: { index: false, follow: false } };

const SITUACAO: Record<string, string> = { ATIVA: "Ativa", SUSPENSA: "Suspensa", PROVISIONANDO: "Em provisionamento" };

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
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Equipe Avila Ops</span>
        <h1>Em qual loja você quer entrar?</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Você entra com os poderes do dono da loja. A entrada fica registrada com o seu e-mail ({r.email}).
        </p>
        {lojas.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600">Nenhuma loja ativa.</p>
        ) : (
          <ul className="mt-6 grid gap-2">
            {lojas.map((l) => (
              <li key={l.slug}>
                {/* Formulário e não link: entrar abre sessão, e isso não acontece em GET. */}
                <form action="/api/painel/entrar/equipe" method="post">
                  <input type="hidden" name="slug" value={l.slug} />
                  <button type="submit" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left hover:border-neutral-400">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.nome}</span>
                      <span className="block truncate text-xs text-neutral-500">{l.dominioPrincipal ?? `${l.slug}.${base}`}</span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">{SITUACAO[l.status] ?? l.status}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="pl-auth-links">
          <Link href="/entrar?senha=1">Entrar com e-mail e senha de uma loja</Link>
        </p>
      </div>
    </div>
  );
}
