"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Uma lista de registros, no celular e no computador.
 *
 * Existe porque cada tela do painel vinha resolvendo a mesma coisa de um jeito
 * diferente, e no celular todas terminavam iguais: uma tabela de seis colunas
 * espremida em 393px. O Inventário chegava a 19.672px de altura com 500 linhas
 * e 515 alvos de toque abaixo do mínimo da Apple.
 *
 * A regra que ele aplica: **no celular a linha inteira é o toque**, com a
 * informação empilhada e um chevron indicando que há detalhe; no computador a
 * mesma lista vira tabela, onde a comparação entre linhas é o que importa.
 *
 * Não é a mesma árvore DOM encolhendo. São duas apresentações do mesmo dado,
 * porque a tarefa é diferente: no balcão se procura **um** item; na mesa se
 * compara **vários**.
 */
export type Coluna<T> = {
  /** Cabeçalho no computador. */
  rotulo: string;
  /** Conteúdo da célula. */
  celula: (item: T) => React.ReactNode;
  /** Números alinham à direita e usam `tabular-nums`. */
  numero?: boolean;
  /** Largura fixa da coluna (classe do Tailwind), para o nome não empurrar o resto. */
  largura?: string;
  /** Fica de fora do cartão do celular: no cartão só entra o que decide. */
  soNoComputador?: boolean;
};

export default function ListaDeRegistros<T extends { id: string }>({
  itens,
  colunas,
  href,
  titulo,
  subtitulo,
  selo,
  acoes,
  vazio,
  carregando,
}: {
  itens: T[];
  colunas: Array<Coluna<T>>;
  /** Para onde a linha leva. Sem isso a linha não é clicável. */
  href?: (item: T) => string;
  /** Primeira linha do cartão no celular. */
  titulo: (item: T) => React.ReactNode;
  /** Segunda linha, miúda: SKU, categoria, data. */
  subtitulo?: (item: T) => React.ReactNode;
  /** O estado que decide: estoque, situação do pedido, "sem foto". */
  selo?: (item: T) => React.ReactNode;
  /** Ação secundária, no fim da linha. Some do cartão quando há `href`: a
   *  ação mora na tela de detalhe, não repetida em centenas de linhas. */
  acoes?: (item: T) => React.ReactNode;
  vazio?: React.ReactNode;
  carregando?: boolean;
}) {
  if (itens.length === 0) return <>{vazio ?? null}</>;

  return (
    <>
      {/* Celular: cartão por registro, linha inteira clicável. */}
      <ul className={`grid gap-2 sm:hidden ${carregando ? "opacity-50" : ""}`}>
        {itens.map((item) => {
          const conteudo = (
            <>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{titulo(item)}</div>
                {subtitulo && <div className="mt-0.5 text-xs text-muted-foreground">{subtitulo(item)}</div>}
                {selo && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">{selo(item)}</div>}
              </div>
              {href && <ChevronRight size={16} className="mt-0.5 flex-none text-muted-foreground" aria-hidden="true" />}
            </>
          );

          return (
            <li key={item.id}>
              {href ? (
                // A linha inteira é o alvo, com folga bem acima dos 44px: o
                // padrão antigo era um "ajustar" sublinhado de 17px por linha.
                <Link href={href(item)} className="flex min-h-[56px] w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition active:bg-muted">
                  {conteudo}
                </Link>
              ) : (
                // Sem `href` nao ha tela de detalhe, entao a acao mora aqui
                // mesmo: e o unico lugar onde ela cabe.
                <div className="flex min-h-[56px] items-start gap-3 rounded-lg border border-border p-3">
                  {conteudo}
                  {acoes && <div className="flex-none">{acoes(item)}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Computador: tabela, onde comparar linhas é o que importa. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              {colunas.map((c) => (
                <th key={c.rotulo} className={`py-2 pr-4 font-medium ${c.largura ?? ""} ${c.numero ? "text-right" : ""}`}>
                  {c.rotulo}
                </th>
              ))}
              {acoes && <th className="w-28 py-2" />}
            </tr>
          </thead>
          <tbody className={carregando ? "opacity-50" : undefined}>
            {itens.map((item) => (
              <tr key={item.id} className="border-t border-border align-top">
                {colunas.map((c, i) => (
                  <td key={c.rotulo} className={`py-2.5 pr-4 ${c.numero ? "text-right tabular-nums whitespace-nowrap" : ""}`}>
                    {i === 0 && href ? (
                      <Link href={href(item)} className="hover:underline">{c.celula(item)}</Link>
                    ) : (
                      c.celula(item)
                    )}
                  </td>
                ))}
                {acoes && <td className="py-2.5 text-right text-xs whitespace-nowrap">{acoes(item)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
