"use client";

import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { formatarBRL } from "@/lib/catalogo";
import { adicionarAoCarrinho } from "@/lib/eventos-loja";

interface Sugestao { id: string; slug: string; nome: string; precoCentavos: number; imagem: string | null; adicionarDireto?: boolean }

/**
 * Produtos das mesmas categorias e destaques. Não pressupõe venda conjunta
 * nem compatibilidade; apresentações com opções são escolhidas na ficha.
 */
export default function Sugestoes() {
  const { itens, adicionar, pronto } = useCart();
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [ultimoAdicionado, setUltimoAdicionado] = useState<{ id: string; nome: string } | null>(null);

  // Busca uma vez, com o carrinho que existia ao abrir a página: a lista
  // pulando a cada item adicionado atrapalharia mais do que ajudaria.
  useEffect(() => {
    if (!pronto || itens.length === 0) return;
    const cancelar = new AbortController();
    fetch("/api/sugestoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: itens.map((i) => i.id) }),
      signal: cancelar.signal,
    })
      .then((r) => (r.ok ? r.json() : { produtos: [] }))
      .then((d) => setSugestoes((d.produtos ?? []).filter((p: Sugestao) => Number.isFinite(p.precoCentavos) && p.precoCentavos > 0)))
      .catch(() => {});
    return () => cancelar.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, [pronto]);

  const noCarrinho = new Set(itens.map(i => i.id.split(":")[0]));
  const disponiveis = sugestoes.filter(s => !noCarrinho.has(s.id));
  const confirmacao = ultimoAdicionado && noCarrinho.has(ultimoAdicionado.id) ? `${ultimoAdicionado.nome} adicionado ao carrinho.` : "";
  if (disponiveis.length === 0 && !confirmacao) return null;

  return (
    <section className="mt-8">
      <p role="status" className="text-sm text-emerald-700">{confirmacao}</p>
      {disponiveis.length > 0 && <>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Explore também</h2>
      <p className="mb-3 text-sm text-muted-foreground">Veja outros produtos da loja. Confira a aplicação e as características antes de escolher.</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {disponiveis.map((s) => (
          <li key={s.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <a href={`/produtos/${s.slug}`} className="block aspect-square bg-muted" aria-label={`Ver ${s.nome}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.imagem && <img src={s.imagem} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </a>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <a href={`/produtos/${s.slug}`} className="line-clamp-2 text-xs font-semibold">{s.nome}</a>
              <p className="mt-auto text-sm font-bold">{formatarBRL(s.precoCentavos)}</p>
              {s.adicionarDireto === true ? <button
                aria-label={`Adicionar sugestão: ${s.nome}`}
                className="btn-secundario min-h-11 w-full text-xs"
                onClick={() => {
                  adicionar({ id: s.id, slug: s.slug, nome: s.nome, precoCentavos: s.precoCentavos, imagem: s.imagem ?? undefined });
                  adicionarAoCarrinho({ id: s.id, nome: s.nome, precoCentavos: s.precoCentavos });
                  setUltimoAdicionado({ id: s.id, nome: s.nome });
                }}
              >
                Adicionar
              </button> : <a className="btn-secundario flex min-h-11 items-center justify-center text-xs" href={`/produtos/${s.slug}`}>Ver opções e detalhes</a>}
            </div>
          </li>
        ))}
      </ul>
      </>}
    </section>
  );
}
