import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { prisma } from "@/lib/db";
import { ConfiguracaoSobMedidaSchema } from "@/lib/configurador-sob-medida";
import { recursoAtivo } from "@/lib/recursos";
import { sessaoDoPainel } from "@/lib/sessao";

export const metadata: Metadata = { title: "Projetos sob medida | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function ProjetosSobMedidaPage() {
  const sessao = await sessaoDoPainel();
  if (!sessao || !recursoAtivo(sessao.tenant, "configurador_sob_medida")) notFound();
  const solicitacoes = await prisma.solicitacaoSobMedida.findMany({
    where: { tenantId: sessao.tenant.id },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });

  return (
    <>
      <CabecalhoSecao titulo="Projetos sob medida" descricao="Configurações enviadas pelo site para análise, orçamento e preparação da ficha técnica." />
      <section className="pl-card overflow-hidden">
        {!solicitacoes.length ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma configuração recebida ainda.</p>
        ) : (
          <div className="grid gap-3 p-3 sm:p-5">
            {solicitacoes.map((solicitacao) => {
              const configuracao = ConfiguracaoSobMedidaSchema.safeParse(solicitacao.configuracao);
              const observacoes = configuracao.success ? configuracao.data.observacoes : "";
              const telefone = solicitacao.telefone?.replace(/\D/g, "");
              return (
                <article key={solicitacao.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><strong>{solicitacao.referencia}</strong><p className="mt-1 text-sm text-muted-foreground">{data.format(solicitacao.criadoEm)} · {solicitacao.estado}</p></div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">Contrato v{solicitacao.contratoVersao}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium">{solicitacao.resumo}</p>
                  {observacoes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{observacoes}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{solicitacao.nome}</span>
                    <Link className="btn-primario" href={`/painel/sob-medida/${solicitacao.id}`}>Abrir ficha técnica</Link>
                    {solicitacao.email && <a className="btn-secundario" href={`mailto:${solicitacao.email}`}>Enviar e-mail</a>}
                    {telefone && <a className="btn-secundario" href={`https://wa.me/${telefone}`} target="_blank" rel="noopener">Abrir WhatsApp</a>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
