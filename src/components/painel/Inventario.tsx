"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Secao } from "./campos";
import ListaDeRegistros from "@/components/aplicacao/ListaDeRegistros";
import Paginacao from "@/components/aplicacao/Paginacao";
import Filtros from "@/components/aplicacao/Filtros";
import Vazio from "@/components/aplicacao/Vazio";

/**
 * O inventário: procurar um item, ver quanto tem, ajustar.
 *
 * A tela antiga mandava 500 linhas de tabela de uma vez, e no celular ficava
 * com 19.672px de altura e 515 alvos de toque abaixo de 44px — cada linha
 * repetia um "ajustar" sublinhado de 17px. Cinquenta telas de rolagem para
 * achar um produto.
 *
 * Agora a pergunta vem antes da lista ("quantos estão esgotados?"), a busca
 * entende SKU e medida, e o ajuste acontece na própria linha porque é a tarefa
 * inteira: digitar um número e salvar.
 */
type Item = { id: string; nome: string; sku: string | null; estoque: number | null; precoCentavos: number };
type Resposta = {
  total: number; pagina: number; paginas: number; porPagina: number;
  resumo: { todos: number; esgotados: number; baixo: number; limiteBaixo: number };
  itens: Item[];
};

export default function Inventario({
  chamar,
  ocupado,
}: {
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      setAplicada(busca.trim());
      setPagina(1);
    }, 300);
    return () => { if (relogio.current) clearTimeout(relogio.current); };
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (aplicada) p.set("q", aplicada);
    if (situacao) p.set("situacao", situacao);
    try {
      const r = await fetch(`/api/painel/estoque?${p}`);
      if (r.ok) setDados((await r.json()) as Resposta);
    } catch {
      // Falha de rede não apaga a lista que já está na tela.
    } finally {
      setCarregando(false);
    }
  }, [pagina, aplicada, situacao]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar(item: Item) {
    const valor = rascunho[item.id];
    if (valor == null || valor === "") return;
    const estoque = Math.max(0, Math.trunc(Number(valor)));
    if (!Number.isFinite(estoque) || estoque === item.estoque) return;
    await chamar("/api/painel/produtos", "PATCH", { id: item.id, estoque }, "Estoque atualizado.");
    setRascunho((r) => { const { [item.id]: _, ...resto } = r; return resto; });
    void carregar();
  }

  const r = dados?.resumo;
  const filtrando = Boolean(aplicada || situacao);

  /** O estado que decide, na linguagem do balcão. */
  const situacaoDo = (item: Item) => {
    const n = item.estoque ?? 0;
    if (n === 0) return <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">Esgotado</span>;
    if (r && n <= r.limiteBaixo) return <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">Últimas {n}</span>;
    return <span className="text-muted-foreground">{n} em estoque</span>;
  };

  /** O ajuste é a tarefa inteira: um número e salvar. */
  const ajuste = (item: Item) => (
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={`Estoque de ${item.nome}`}
        className="h-11 w-20 rounded-lg border border-border bg-background px-2 text-right text-base tabular-nums sm:text-sm"
        value={rascunho[item.id] ?? String(item.estoque ?? 0)}
        onChange={(e) => setRascunho((x) => ({ ...x, [item.id]: e.target.value }))}
        onKeyDown={(e) => e.key === "Enter" && salvar(item)}
      />
      <button
        className="btn-secundario inline-flex h-11 items-center px-3 text-xs disabled:opacity-40"
        disabled={ocupado || rascunho[item.id] == null || rascunho[item.id] === String(item.estoque ?? 0)}
        onClick={() => salvar(item)}
      >
        Salvar
      </button>
    </span>
  );

  return (
    <Secao titulo="Inventário" descricao="Procure pelo nome ou código, confira quanto tem e ajuste na hora.">
      <Filtros
        busca={busca}
        aoBuscar={setBusca}
        exemplo="Nome ou código do produto"
        ativa={situacao}
        aoEscolher={(v) => { setSituacao(v); setPagina(1); }}
        fichas={[
          { valor: "", rotulo: r ? `Todos (${r.todos.toLocaleString("pt-BR")})` : "Todos" },
          { valor: "esgotado", rotulo: r ? `Esgotados (${r.esgotados.toLocaleString("pt-BR")})` : "Esgotados" },
          { valor: "baixo", rotulo: r ? `Acabando (${r.baixo.toLocaleString("pt-BR")})` : "Acabando" },
        ]}
      />

      {dados && (
        <>
          <ListaDeRegistros
            itens={dados.itens}
            carregando={carregando}
            titulo={(i) => i.nome}
            subtitulo={(i) => (i.sku ? `Código ${i.sku}` : null)}
            selo={(i) => (
              <>
                {situacaoDo(i)}
                {/* O ajuste fica no cartão porque é a tarefa da tela: mandar
                    para uma página de detalhe só para digitar um número
                    custaria dois toques a mais por item. */}
                <span className="ml-auto">{ajuste(i)}</span>
              </>
            )}
            colunas={[
              { rotulo: "Produto", celula: (i) => i.nome },
              { rotulo: "Código", celula: (i) => i.sku ?? "—", largura: "w-28" },
              { rotulo: "Situação", celula: (i) => situacaoDo(i), largura: "w-36" },
              { rotulo: "Ajustar", celula: (i) => ajuste(i), largura: "w-44", numero: true },
            ]}
            vazio={
              <Vazio
                titulo={filtrando ? "Nenhum produto com esse filtro." : "Nenhum produto com estoque contado."}
                texto={
                  filtrando
                    ? "Tente outro termo, ou limpe o filtro para ver o inventário inteiro."
                    : "Produtos sem contagem de estoque não aparecem aqui. Abra um produto e informe a quantidade para acompanhá-lo."
                }
                acao={filtrando ? { rotulo: "Limpar filtro", onClick: () => { setBusca(""); setSituacao(""); } } : undefined}
              />
            }
          />

          <Paginacao
            pagina={dados.pagina}
            paginas={dados.paginas}
            total={dados.total}
            porPagina={dados.porPagina}
            ocupado={carregando || ocupado}
            aoMudar={setPagina}
            substantivo="produtos"
          />
        </>
      )}
    </Secao>
  );
}
