import type { Metadata } from "next";
import Link from "next/link";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import GraficoCanais from "@/components/painel/GraficoCanais";
import { formatarBRL } from "@/lib/catalogo";
import { resolverPeriodoAnalytics } from "@/lib/analytics-vendas";
import { AJUDA_CANAL, JANELA_ATRIBUICAO_DIAS, relatorioDeAtribuicao } from "@/lib/atribuicao";
import { lojistaAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Atribuição", robots: { index: false } };
export const dynamic = "force-dynamic";

type Entrada = { periodo?: string; de?: string; ate?: string };

/**
 * Atribuição: de onde vem quem compra.
 *
 * A tela existe para responder uma pergunta que Análises não respondia — qual
 * canal paga a conta —, e ela tem uma honestidade obrigatória: enquanto não
 * houver sessão medida, não há gráfico. Desenhar uma curva em zero faria o
 * lojista concluir que ninguém entra na loja dele, quando o que aconteceu é
 * que a medição começou ontem.
 */
export default async function PaginaAtribuicao({ searchParams }: { searchParams: Promise<Entrada> }) {
  const [loja, entrada] = await Promise.all([lojistaAtual(), searchParams]);
  if (!loja) return null;
  const periodo = resolverPeriodoAnalytics(entrada);
  const dados = await relatorioDeAtribuicao(loja.id, periodo);

  const totalPedidos = dados.canais.reduce((s, c) => s + c.pedidos, 0);
  const totalVendas = dados.canais.reduce((s, c) => s + c.vendasCentavos, 0);

  return (
    <>
      <CabecalhoSecao titulo="Atribuição" descricao="Que canal traz quem compra" />

      <section className="an-filtros" aria-label="Período da atribuição">
        <nav aria-label="Períodos rápidos">
          {[["Hoje", "hoje"], ["7 dias", "7d"], ["30 dias", "30d"], ["90 dias", "90d"]].map(([rotulo, chave]) => (
            <Link key={chave} href={`/painel/analises/atribuicao?periodo=${chave}`} className={periodo.chave === chave ? "ativo" : ""}>{rotulo}</Link>
          ))}
        </nav>
        <form method="get" action="/painel/analises/atribuicao">
          <label>De <input type="date" name="de" defaultValue={entrada.de} /></label>
          <label>Até <input type="date" name="ate" defaultValue={entrada.ate} /></label>
          <button type="submit">Aplicar</button>
        </form>
        <p>
          <strong>{periodo.rotulo}</strong> · último clique não direto, janela de {JANELA_ATRIBUICAO_DIAS} dias
        </p>
      </section>

      {!dados.temMedicao ? (
        <section className="an-vazio">
          <h2>A medição desta loja ainda não registrou nenhuma visita.</h2>
          <p>
            Sessão, canal de origem e taxa de conversão só existem a partir do momento em que a medição começa — não dá
            para calculá-los do histórico de pedidos, como se faz com receita. Assim que alguém abrir a loja, os
            números aparecem aqui.
          </p>
          <Link href="/painel/analises">Ver vendas</Link>
        </section>
      ) : (
        <>
          <div className="an-grid-kpis">
            <article className="an-kpi" title="Visitas distintas à loja no período. Uma sessão termina após 30 minutos sem página nova.">
              <div className="an-kpi-titulo"><span>Sessões</span><span aria-label="Como é calculado">?</span></div>
              <strong>{dados.sessoes.toLocaleString("pt-BR")}</strong>
            </article>
            <article className="an-kpi" title="Pedidos pagos no período, creditados ao canal que os trouxe.">
              <div className="an-kpi-titulo"><span>Pedidos</span><span aria-label="Como é calculado">?</span></div>
              <strong>{totalPedidos.toLocaleString("pt-BR")}</strong>
            </article>
            <article className="an-kpi" title="Total cobrado nos pedidos pagos do período.">
              <div className="an-kpi-titulo"><span>Vendas</span><span aria-label="Como é calculado">?</span></div>
              <strong>{formatarBRL(totalVendas)}</strong>
            </article>
            <article className="an-kpi" title="Pedidos pagos divididos pelas sessões do período.">
              <div className="an-kpi-titulo"><span>Conversão</span><span aria-label="Como é calculado">?</span></div>
              <strong>{dados.sessoes ? `${(Math.round((totalPedidos / dados.sessoes) * 1000) / 10).toLocaleString("pt-BR")}%` : "—"}</strong>
            </article>
          </div>

          <section className="an-bloco an-desempenho">
            <header>
              <div><small>Ao longo do tempo</small><h2>Sessões dos 5 principais canais</h2></div>
            </header>
            <GraficoCanais serie={dados.serie} canais={dados.topCanais.map((c) => ({ canal: c, rotulo: dados.canais.find((l) => l.canal === c)!.rotulo }))} />
          </section>

          <section className="an-bloco">
            <header><div><small>Canais</small><h2>O que cada um trouxe</h2></div></header>
            <div className="atr-tabela-rolagem">
              <table className="atr-tabela">
                <thead>
                  <tr>
                    <th scope="col">Canal</th>
                    <th scope="col">Sessões</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col">Vendas</th>
                    <th scope="col">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.canais.map((c) => (
                    <tr key={c.canal}>
                      <th scope="row">
                        <span>{c.rotulo}</span>
                        <small>{AJUDA_CANAL[c.canal]}</small>
                      </th>
                      <td>{c.sessoes.toLocaleString("pt-BR")}</td>
                      <td>{c.pedidos.toLocaleString("pt-BR")}</td>
                      <td>{formatarBRL(c.vendasCentavos)}</td>
                      {/* Traço, e não 0%: sem sessão medida não existe taxa, e
                          escrever zero afirmaria que o canal não converte. */}
                      <td>{c.conversao === null ? "—" : `${c.conversao.toLocaleString("pt-BR")}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados.pedidosSemSessao > 0 && (
              <p className="an-nota">
                {dados.pedidosSemSessao.toLocaleString("pt-BR")} pedido(s) do período não têm sessão associada e entram
                como Direto: são pedidos anteriores ao início da medição, compras de quem recusou cookies ou vendas
                criadas fora do site.
              </p>
            )}
          </section>

          {dados.campanhas.length > 0 && (
            <section className="an-bloco">
              <header><div><small>Campanhas</small><h2>Links marcados com utm_campaign</h2></div></header>
              <div className="atr-tabela-rolagem">
                <table className="atr-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Campanha</th>
                      <th scope="col">Sessões</th>
                      <th scope="col">Pedidos</th>
                      <th scope="col">Vendas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.campanhas.map((c) => (
                      <tr key={`${c.campanha}-${c.canal}`}>
                        <th scope="row">
                          <span>{c.campanha}</span>
                          <small>{c.origem ?? c.canal}</small>
                        </th>
                        <td>{c.sessoes.toLocaleString("pt-BR")}</td>
                        <td>{c.pedidos.toLocaleString("pt-BR")}</td>
                        <td>{formatarBRL(c.vendasCentavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <section className="an-bloco">
        <header><div><small>Como lemos</small><h2>O que “último clique não direto” quer dizer</h2></div></header>
        <p className="an-nota">
          A mesma pessoa clica no seu anúncio na segunda, pensa, e volta na quinta digitando o endereço da loja.
          Creditar a venda à visita da compra daria todo o mérito a “Direto” e nenhum ao anúncio que pagou por ela.
          Por isso o pedido vai para o último canal identificável dos últimos {JANELA_ATRIBUICAO_DIAS} dias, e só cai em
          Direto quando realmente não houve nenhum.
        </p>
        <p className="an-nota">
          A medição é feita no seu próprio domínio, sem enviar nada a terceiros, e não guarda IP nem identificação de
          quem visita. Ligar a visita de hoje à de ontem depende de o visitante aceitar cookies; sem isso, cada visita
          é contada por si, e a atribuição enxerga só dentro dela.
        </p>
      </section>
    </>
  );
}
