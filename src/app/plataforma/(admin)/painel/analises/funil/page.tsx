import type { Metadata } from "next";
import Link from "next/link";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { resolverPeriodoAnalytics } from "@/lib/analytics-vendas";
import { relatorioDoFunil } from "@/lib/funil-analytics";
import { lojistaAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Funil da loja", robots: { index: false } };
export const dynamic = "force-dynamic";

type Entrada = { periodo?: string; de?: string; ate?: string };
const percentual = (valor: number | null) => valor == null ? "—" : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function PaginaFunil({ searchParams }: { searchParams: Promise<Entrada> }) {
  const [loja, entrada] = await Promise.all([lojistaAtual(), searchParams]);
  if (!loja) return null;
  const periodo = resolverPeriodoAnalytics(entrada);
  const dados = await relatorioDoFunil(loja.id, periodo);
  const { contagens: c, taxas: t } = dados;
  const etapas = [
    { nome: "Sessões", valor: c.sessoes, taxa: c.sessoes ? "100%" : "—", ajuda: "Visitas únicas medidas no período" },
    { nome: "Viram produto", valor: c.produtos, taxa: percentual(t.produto), ajuda: "sobre sessões" },
    { nome: "Adicionaram", valor: c.carrinhosAdicionados, taxa: percentual(t.carrinho), ajuda: "sobre quem viu produto" },
    { nome: "Iniciaram checkout", valor: c.checkouts, taxa: percentual(t.checkout), ajuda: "sobre quem adicionou" },
    { nome: "Criaram pedido", valor: c.pedidosCriados, taxa: percentual(c.checkouts ? c.pedidosCriados / c.checkouts * 100 : null), ajuda: "sobre quem iniciou checkout" },
    { nome: "Pagamento aprovado", valor: c.pagamentosAprovados, taxa: percentual(t.pagamento), ajuda: "sobre pedidos criados" },
  ];

  return (
    <>
      <CabecalhoSecao titulo="Funil da loja" descricao="Da descoberta do catálogo até a compra paga" />
      <section className="an-filtros" aria-label="Período do funil">
        <nav aria-label="Períodos rápidos">
          {[["Hoje", "hoje"], ["7 dias", "7d"], ["30 dias", "30d"], ["90 dias", "90d"]].map(([rotulo, chave]) => (
            <Link key={chave} href={`/painel/analises/funil?periodo=${chave}`} className={periodo.chave === chave ? "ativo" : ""}>{rotulo}</Link>
          ))}
        </nav>
        <form method="get" action="/painel/analises/funil">
          <label>De <input type="date" name="de" defaultValue={entrada.de} /></label>
          <label>Até <input type="date" name="ate" defaultValue={entrada.ate} /></label>
          <button type="submit">Aplicar</button>
        </form>
        <p><strong>{periodo.rotulo}</strong> · sessões únicas; pedidos externos não entram na conversão</p>
      </section>

      {c.sessoes === 0 ? (
        <section className="an-vazio">
          <h2>A medição ainda não registrou sessões neste período.</h2>
          <p>O funil começa a aparecer após visitas à vitrine. Vendas continuam no relatório geral, mesmo quando não têm uma sessão vinculada.</p>
          <Link href="/painel/analises">Ver vendas</Link>
        </section>
      ) : (
        <section className="an-bloco an-funil" aria-labelledby="titulo-funil">
          <header><div><small>Conversão</small><h2 id="titulo-funil">Jornada principal</h2></div><strong>{percentual(t.compra)} compraram</strong></header>
          <ol>
            {etapas.map((etapa, indice) => (
              <li key={etapa.nome} style={{ "--largura": `${Math.max(12, (etapa.valor / Math.max(c.sessoes, 1)) * 100)}%` } as React.CSSProperties}>
                <div><span>{indice + 1}</span><b>{etapa.nome}</b><strong>{etapa.valor.toLocaleString("pt-BR")}</strong></div>
                <div className="an-funil-barra"><i /></div>
                <small>{etapa.taxa} · {etapa.ajuda}</small>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="an-grid-kpis an-funil-diagnosticos">
        <article className="an-kpi"><div className="an-kpi-titulo"><span>Busca sem resultado</span><span title="Sessões com busca sem resultado sobre sessões que buscaram">?</span></div><strong>{percentual(t.buscaSemResultado)}</strong><small>{c.buscasSemResultado} de {c.buscas} sessão(ões) com busca</small></article>
        <article className="an-kpi"><div className="an-kpi-titulo"><span>Contato técnico</span><span title="Sessões que abriram contato sobre sessões que viram produto">?</span></div><strong>{percentual(t.contatoTecnico)}</strong><small>{c.contatosTecnicos} contato(s) · {c.produtos} sessão(ões) com produto</small></article>
        <article className="an-kpi"><div className="an-kpi-titulo"><span>Aplicaram filtros</span><span title="Sessões únicas que aplicaram algum filtro">?</span></div><strong>{c.filtros.toLocaleString("pt-BR")}</strong><small>sessão(ões) refinaram o catálogo</small></article>
        <article className="an-kpi"><div className="an-kpi-titulo"><span>Clientes recorrentes</span><span title="Compradores do período com compra paga anterior">?</span></div><strong>{percentual(t.recompra)}</strong><small>{c.clientesRecorrentes} de {c.clientesCompradores} comprador(es)</small></article>
      </div>

      <p className="an-nota">Medição first-party: sem IP, user-agent, termo buscado ou conteúdo de mensagens. Sem consentimento, uma sessão não é ligada à próxima visita.</p>
    </>
  );
}

