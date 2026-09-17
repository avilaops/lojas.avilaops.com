import type { Metadata } from "next";
import Link from "next/link";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { formatarBRL } from "@/lib/catalogo";
import { analyticsDeVendas, resolverPeriodoAnalytics } from "@/lib/analytics-vendas";
import { relatorioDeAtribuicao } from "@/lib/atribuicao";
import { lojistaAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Análises", robots: { index: false } };
export const dynamic = "force-dynamic";

type Entrada = { periodo?: string; de?: string; ate?: string };

function Variacao({ valor, sufixo = "%" }: { valor: number | null; sufixo?: string }) {
  if (valor === null) return <span className="an-comparacao an-neutra">Sem base anterior</span>;
  const texto = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.abs(valor));
  return <span className={`an-comparacao ${valor >= 0 ? "an-positiva" : "an-negativa"}`}>{valor >= 0 ? "↑" : "↓"} {texto}{sufixo} vs. período anterior</span>;
}

function Kpi({ titulo, valor, ajuda, variacao }: { titulo: string; valor: string; ajuda: string; variacao?: number | null }) {
  return (
    <article className="an-kpi" title={ajuda}>
      <div className="an-kpi-titulo"><span>{titulo}</span><span aria-label="Como é calculado">?</span></div>
      <strong>{valor}</strong>
      {variacao !== undefined && <Variacao valor={variacao} />}
    </article>
  );
}

export default async function PaginaAnalises({ searchParams }: { searchParams: Promise<Entrada> }) {
  const [loja, entrada] = await Promise.all([lojistaAtual(), searchParams]);
  if (!loja) return null;
  const periodo = resolverPeriodoAnalytics(entrada);
  const [dados, atribuicao] = await Promise.all([analyticsDeVendas(loja.id, periodo), relatorioDeAtribuicao(loja.id, periodo)]);
  const maximo = Math.max(...dados.serie.map((p) => p.receitaCentavos), 1);
  const temVendas = dados.pedidos > 0;

  return (
    <>
      <CabecalhoSecao titulo="Análises" descricao="Visão geral do desempenho da sua loja" />

      <section className="an-filtros" aria-label="Período da análise">
        <nav aria-label="Períodos rápidos">
          {[["Hoje", "hoje"], ["7 dias", "7d"], ["30 dias", "30d"], ["90 dias", "90d"]].map(([rotulo, chave]) => (
            <Link key={chave} href={`/painel/analises?periodo=${chave}`} className={periodo.chave === chave ? "ativo" : ""}>{rotulo}</Link>
          ))}
        </nav>
        <form method="get" action="/painel/analises">
          <label>De <input type="date" name="de" defaultValue={entrada.de} /></label>
          <label>Até <input type="date" name="ate" defaultValue={entrada.ate} /></label>
          <button type="submit">Aplicar</button>
        </form>
        <p><strong>{periodo.rotulo}</strong> · comparado ao período anterior</p>
      </section>

      <div className="an-grid-kpis">
        <Kpi titulo="Receita recebida" valor={formatarBRL(dados.receitaRecebidaCentavos)} variacao={dados.comparacao.receita} ajuda="Total efetivamente cobrado nos pedidos pagos, incluindo frete e descontando descontos." />
        <Kpi titulo="Pedidos pagos" valor={dados.pedidos.toLocaleString("pt-BR")} variacao={dados.comparacao.pedidos} ajuda="Pedidos pagos, em separação, enviados ou entregues. Cancelados e estornados não entram." />
        <Kpi titulo="Ticket médio" valor={formatarBRL(dados.ticketMedioCentavos)} variacao={dados.comparacao.ticket} ajuda="Receita recebida dividida pela quantidade de pedidos pagos." />
        <Kpi titulo="Clientes compradores" valor={dados.clientesCompradores.toLocaleString("pt-BR")} ajuda="E-mails únicos associados a pedidos pagos no período. Não significa conta cadastrada." />
      </div>

      {!temVendas ? (
        <section className="an-vazio">
          <h2>Você ainda não teve vendas neste período.</h2>
          <p>Assim que o primeiro pedido for pago, receita, ticket médio e produtos vendidos aparecerão aqui.</p>
          <Link href="/painel/produtos">Revisar catálogo</Link>
        </section>
      ) : (
        <div className="an-grid-principal">
          <section className="an-bloco an-desempenho">
            <header><div><small>Desempenho</small><h2>Receita por dia</h2></div><strong>{formatarBRL(dados.receitaRecebidaCentavos)}</strong></header>
            <div className="an-grafico" role="img" aria-label={`Receita diária; maior valor ${formatarBRL(maximo)}`}>
              {dados.serie.map((p) => <span key={p.dia} title={`${p.rotulo}: ${formatarBRL(p.receitaCentavos)} em ${p.pedidos} pedido(s)`} style={{ height: `${Math.max(3, p.receitaCentavos / maximo * 100)}%` }} />)}
            </div>
            <div className="an-eixo"><span>{dados.serie[0]?.rotulo}</span><span>Toque nas barras para ver o valor</span><span>{dados.serie.at(-1)?.rotulo}</span></div>
          </section>

          <section className="an-bloco">
            <header><div><small>Composição</small><h2>De onde vem o total</h2></div></header>
            <dl className="an-composicao">
              <div><dt>Receita bruta de itens</dt><dd>{formatarBRL(dados.receitaBrutaCentavos)}</dd></div>
              <div><dt>Descontos concedidos</dt><dd>-{formatarBRL(dados.descontosCentavos)}</dd></div>
              <div><dt>Frete cobrado</dt><dd>{formatarBRL(dados.freteCentavos)}</dd></div>
              <div className="total"><dt>Receita recebida</dt><dd>{formatarBRL(dados.receitaRecebidaCentavos)}</dd></div>
            </dl>
            <p className="an-nota">Reembolsos ainda não aparecem separadamente porque o histórico atual não registra o valor reembolsado com precisão.</p>
          </section>
        </div>
      )}

      <div className="an-grid-secundario">
        <section className="an-bloco">
          <header><div><small>Produtos</small><h2>Mais vendidos por receita</h2></div><Link href="/painel/produtos">Ver catálogo</Link></header>
          {dados.produtos.length ? <ol className="an-ranking">{dados.produtos.map((produto, indice) => <li key={produto.produtoId ?? produto.nome}><b>{indice + 1}</b><span>{produto.nome}<small>{produto.quantidade.toLocaleString("pt-BR")} item(ns)</small></span><strong>{formatarBRL(produto.receitaCentavos)}</strong></li>)}</ol> : <p className="an-nota">Os produtos aparecem depois da primeira venda paga no período.</p>}
        </section>

        <section className="an-bloco">
          <header><div><small>Origem</small><h2>De onde vem quem compra</h2><Link href="/painel/analises/atribuicao">Ver atribuição</Link></div></header>
          {atribuicao.temMedicao ? (
            <ol className="an-ranking">
              {atribuicao.canais.slice(0, 5).map((c, i) => (
                <li key={c.canal}>
                  <b>{i + 1}</b>
                  <span>{c.rotulo}<small>{c.sessoes.toLocaleString("pt-BR")} sessão(ões) · {c.pedidos.toLocaleString("pt-BR")} pedido(s)</small></span>
                  <strong>{formatarBRL(c.vendasCentavos)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            /* Sem sessão medida não há canal: o texto diz por que, em vez de
               desenhar uma lista em zero que o lojista leria como "ninguém
               entra na minha loja". */
            <p className="an-nota">
              A medição da vitrine ainda não registrou visitas nesta loja. Sessão, canal de origem e taxa de conversão
              passam a existir a partir do primeiro acesso medido — não é possível calculá-los do histórico de pedidos,
              como se faz com receita.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
