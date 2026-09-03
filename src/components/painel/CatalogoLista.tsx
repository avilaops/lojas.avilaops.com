"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageOff, Search, X } from "lucide-react";
import { Secao } from "./campos";

/**
 * O catálogo do painel: busca, filtro e página.
 *
 * A tela antiga trazia os 500 primeiros produtos ordenados por nome e mais
 * nada. Numa distribuidora com 5.591 itens, o lojista não enxergava 91% do que
 * vende, e para mexer no preço de um produto que começa com "R" não havia
 * caminho nenhum.
 *
 * A busca é a mesma da vitrine (`termosDeBusca`), então "ROL6205" e "25x52x15"
 * funcionam aqui também: é o gesto que ele já conhece.
 */
type Item = {
  id: string;
  nome: string;
  categoria: string | null;
  sku: string | null;
  precoCentavos: number;
  estoque: number | null;
  ativo: boolean;
  destaque: boolean;
  opcoes: string[];
  variantes: number;
  temFoto: boolean;
};

type Resposta = { total: number; pagina: number; paginas: number; porPagina: number; produtos: Item[] };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Os filtros que respondem a uma pergunta do dia, não a um campo do banco. */
const SITUACOES = [
  { valor: "", rotulo: "Todos" },
  { valor: "esgotado", rotulo: "Esgotados" },
  { valor: "sem-foto", rotulo: "Sem foto" },
  { valor: "sem-preco", rotulo: "Sem preço" },
  { valor: "inativo", rotulo: "Desativados" },
];

export default function CatalogoLista({
  categorias,
  chamar,
  ocupado,
}: {
  categorias: Array<{ slug: string; nome: string }>;
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);

  // Guarda a busca aplicada, e não a digitada: sem isso cada tecla dispara uma
  // consulta ao banco num catálogo de milhares de itens.
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buscaAplicada, setBuscaAplicada] = useState("");

  useEffect(() => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 300);
    return () => {
      if (relogio.current) clearTimeout(relogio.current);
    };
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (buscaAplicada) p.set("q", buscaAplicada);
    if (categoria) p.set("categoria", categoria);
    if (situacao) p.set("situacao", situacao);
    try {
      const r = await fetch(`/api/painel/catalogo?${p}`);
      if (r.ok) setDados((await r.json()) as Resposta);
    } catch {
      // Falha de rede não pode apagar a lista que já está na tela.
    } finally {
      setCarregando(false);
    }
  }, [pagina, buscaAplicada, categoria, situacao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function desativar(p: Item) {
    await chamar(`/api/painel/produtos?id=${p.id}`, "DELETE", undefined, "Produto desativado.");
    void carregar();
  }

  const filtrando = Boolean(buscaAplicada || categoria || situacao);
  const total = dados?.total ?? 0;
  const paginas = dados?.paginas ?? 1;
  const primeiro = total === 0 ? 0 : (pagina - 1) * (dados?.porPagina ?? 50) + 1;
  const ultimo = Math.min(pagina * (dados?.porPagina ?? 50), total);

  return (
    <Secao
      titulo="Catálogo"
      descricao="Procure pelo nome, código ou medida. Clique no produto para editar fotos, descrição, estoque e preço."
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, código ou medida (ex.: 6205, 25x52x15)"
            />
            {busca && (
              <button
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Os dois selects dividem a linha no celular: lado a lado com a
              busca eles ficavam com 6 caracteres visíveis. */}
          <select
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm sm:flex-none"
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>{c.nome}</option>
            ))}
          </select>

          <select
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm sm:flex-none"
            value={situacao}
            onChange={(e) => {
              setSituacao(e.target.value);
              setPagina(1);
            }}
          >
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor}>{s.rotulo}</option>
            ))}
          </select>
        </div>

        <p className="text-sm text-muted-foreground">
          {carregando && !dados ? (
            "Carregando…"
          ) : total === 0 ? (
            filtrando ? "Nenhum produto encontrado com esses filtros." : "Nenhum produto cadastrado ainda."
          ) : (
            <>
              Mostrando <b>{primeiro}–{ultimo}</b> de <b>{total.toLocaleString("pt-BR")}</b>
              {filtrando ? " que atendem ao filtro" : " produtos"}.
            </>
          )}
        </p>
      </div>

      {/* No celular a tabela vira lista de cartões.
          Seis colunas em 393px de largura obrigam a rolar de lado para ver o
          preço, e num painel que o lojista abre do balcão isso é inútil.
          Medido com scripts/medir-mobile.mts: a tabela pedia 736px. */}
      {dados && dados.produtos.length > 0 && (
        <ul className="grid gap-2 sm:hidden">
          {dados.produtos.map((p) => (
            <li key={p.id} className={`rounded-lg border border-border p-3 ${p.ativo ? "" : "opacity-50"}`}>
              <Link className="block font-medium hover:underline" href={`/painel/produtos/${p.id}`}>
                {p.destaque && "★ "}
                {p.nome}
                {!p.ativo && " (inativo)"}
              </Link>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {p.categoria && <span>{p.categoria}</span>}
                {p.sku && <span className="tabular-nums">SKU {p.sku}</span>}
                {!p.temFoto && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
                    <ImageOff size={10} aria-hidden="true" /> sem foto
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className="tabular-nums">
                  {p.precoCentavos > 0 ? brl(p.precoCentavos) : <span className="text-sm font-normal text-muted-foreground">sob consulta</span>}
                </b>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.opcoes.length
                    ? `${p.variantes} variações`
                    : p.estoque == null
                      ? "estoque livre"
                      : p.estoque === 0
                        ? <span className="font-medium text-red-700">esgotado</span>
                        : `${p.estoque} em estoque`}
                </span>
                {p.ativo && (
                  <button
                    className="ml-auto inline-flex h-9 items-center px-2 text-xs text-muted-foreground underline"
                    disabled={ocupado}
                    onClick={() => desativar(p)}
                  >
                    desativar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {dados && dados.produtos.length > 0 && (
        <div className="hidden overflow-x-auto sm:block">
          {/* Largura mínima e colunas fixas: sem isso o nome técnico ("02400
              JOGO C/8 PÇS (8x14,1x8,9x13) - Retentor…") empurrava as demais e
              SKU e preço apareciam grudados ("4139R$ 90,00"). */}
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-auto py-2 pr-4 font-medium">Produto</th>
                <th className="w-32 py-2 pr-4 font-medium">Categoria</th>
                <th className="w-20 py-2 pr-4 font-medium">SKU</th>
                <th className="w-28 py-2 pr-4 text-right font-medium">Preço</th>
                <th className="w-24 py-2 pr-4 text-right font-medium">Estoque</th>
                <th className="w-28 py-2" />
              </tr>
            </thead>
            <tbody className={carregando ? "opacity-50" : undefined}>
              {dados.produtos.map((p) => (
                <tr key={p.id} className={`border-t border-border align-top ${p.ativo ? "" : "opacity-50"}`}>
                  <td className="py-2.5 pr-4">
                    <Link className="hover:underline" href={`/painel/produtos/${p.id}`}>
                      {p.destaque && "★ "}
                      {p.nome}
                      {!p.ativo && " (inativo)"}
                    </Link>
                    {/* Sem foto é o problema mais caro de um catálogo grande, e
                        aparece no lugar onde a decisão é tomada. Em linha
                        própria: colado ao nome, ele quebrava a coluna no meio
                        de uma palavra. */}
                    {!p.temFoto && (
                      <span className="mt-1 flex w-fit items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                        <ImageOff size={10} aria-hidden="true" /> sem foto
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{p.categoria ?? "—"}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{p.sku ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums whitespace-nowrap">
                    {p.precoCentavos > 0 ? brl(p.precoCentavos) : <span className="text-xs text-muted-foreground">sob consulta</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums whitespace-nowrap">
                    {p.opcoes.length
                      ? <span className="text-xs text-muted-foreground">{p.variantes} variações</span>
                      : p.estoque == null
                        ? <span className="text-muted-foreground">∞</span>
                        : p.estoque === 0
                          ? <span className="text-xs font-medium text-red-700">esgotado</span>
                          : p.estoque}
                  </td>
                  <td className="py-2.5 text-right text-xs whitespace-nowrap">
                    {p.ativo && (
                      <>
                        <Link className="underline" href={`/painel/produtos/${p.id}`}>
                          {p.opcoes.length ? "grade" : "variações"}
                        </Link>
                        <button className="ml-3 text-muted-foreground underline" disabled={ocupado} onClick={() => desativar(p)}>
                          desativar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            className="btn-secundario inline-flex h-10 items-center gap-1 px-3 text-sm disabled:opacity-40"
            disabled={pagina <= 1 || carregando}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          <span className="px-2 text-sm text-muted-foreground">
            Página {pagina} de {paginas}
          </span>
          <button
            className="btn-secundario inline-flex h-10 items-center gap-1 px-3 text-sm disabled:opacity-40"
            disabled={pagina >= paginas || carregando}
            onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
          >
            Próxima <ChevronRight size={15} />
          </button>
        </div>
      )}
    </Secao>
  );
}
