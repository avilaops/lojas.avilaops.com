"use client";

import { formatarBRL } from "@/lib/catalogo";
import type { ResumoVendas } from "@/lib/relatorio";

/**
 * O painel de vendas da Visão geral. Trinta dias, sem escolher período: o
 * lojista de bairro quer saber se este mês está melhor que o passado e o que
 * ele precisa fazer hoje — não montar relatório.
 *
 * O gráfico é SVG na mão de propósito; biblioteca de gráfico custaria mais
 * kilobyte do que a loja inteira.
 *
 * A receita do período fica na faixa de números do topo da Visão geral. Este
 * bloco só existe quando há o que mostrar (venda, fila de espera ou algo a
 * fazer): sem nada disso ele era um cartão inteiro para dizer "nenhuma venda",
 * e a Visão geral precisa caber numa tela.
 */
export default function Vendas({ r, espera, irPara }: { r: ResumoVendas; espera: Array<{ produto: string; pessoas: number }>; irPara: (aba: "Pedidos" | "Produtos") => void }) {
  const maximo = Math.max(...r.serie.map((d) => d.centavos), 1);
  const vendeu = r.pedidos > 0;

  if (!vendeu && espera.length === 0 && r.aSeparar === 0 && r.carrinhosAbertos === 0 && r.aguardandoPagamento === 0) return null;

  return (
    <section className="painel-vendas">
      {/* Quatro zeros lado a lado ocupavam meia tela para nao dizer nada. Sem
          venda, so entra o que tem valor diferente de zero; sem nenhum, o bloco
          inteiro sai e sobra a frase que explica. */}
      {(vendeu || r.aguardandoPagamento > 0 || r.carrinhosAbertos > 0) && (
        <div className="painel-vendas-numeros">
          {vendeu && <div><small>Pedidos pagos</small><strong>{r.pedidos}</strong></div>}
          {vendeu && <div><small>Ticket médio</small><strong>{formatarBRL(r.ticketMedioCentavos)}</strong></div>}
          {r.aguardandoPagamento > 0 && <div><small>Aguardando pagamento</small><strong>{r.aguardandoPagamento}</strong></div>}
          {r.carrinhosAbertos > 0 && <div><small>Carrinhos abertos</small><strong>{r.carrinhosAbertos}</strong></div>}
        </div>
      )}

      {vendeu ? (
        <>
          <div className="painel-grafico" role="img" aria-label={`Receita diária dos últimos 30 dias, maior dia ${formatarBRL(maximo)}`}>
            {r.serie.map((d) => (
              <span key={d.dia} title={`${d.dia} · ${formatarBRL(d.centavos)}`} style={{ height: `${Math.max((d.centavos / maximo) * 100, 2)}%` }} />
            ))}
          </div>
          <p className="painel-grafico-legenda">
            <span>{r.serie[0]?.dia}</span>
            <span>maior dia: {formatarBRL(maximo)}</span>
            <span>{r.serie[r.serie.length - 1]?.dia}</span>
          </p>

          <ol className="painel-top">
            {r.top.slice(0, 3).map((p, i) => (
              <li key={p.nome}>
                <b>{i + 1}</b>
                <span>{p.nome}</span>
                <small>{p.quantidade}un · {formatarBRL(p.centavos)}</small>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {espera.length > 0 && (
        <div className="painel-espera">
          <p><b>Gente esperando produto que acabou.</b> Repor isto é venda quase certa, quem entrou na fila já quis comprar.</p>
          <ul>
            {espera.map((e) => (
              <li key={e.produto}>
                <span>{e.produto}</span>
                <small>{e.pessoas} pessoa{e.pessoas > 1 ? "s" : ""}</small>
              </li>
            ))}
          </ul>
          <button className="btn-secundario" onClick={() => irPara("Produtos")}>Repor estoque</button>
        </div>
      )}

      {(r.aSeparar > 0 || r.carrinhosAbertos > 0) && (
        <div className="painel-acoes-hoje">
          {r.aSeparar > 0 && (
            <button className="btn-primario" onClick={() => irPara("Pedidos")}>
              Separar {r.aSeparar} pedido{r.aSeparar > 1 ? "s" : ""} pago{r.aSeparar > 1 ? "s" : ""}
            </button>
          )}
          {r.carrinhosAbertos > 0 && <span>{r.carrinhosAbertos} carrinho(s) abandonado(s), o lembrete automático já foi disparado.</span>}
        </div>
      )}
    </section>
  );
}
