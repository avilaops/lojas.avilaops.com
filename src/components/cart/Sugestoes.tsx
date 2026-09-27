"use client";

import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { formatarBRL } from "@/lib/catalogo";
import { adicionarAoCarrinho } from "@/lib/eventos-loja";

interface Sugestao { id: string; slug: string; nome: string; precoCentavos: number; imagem: string | null }

/**
 * "Leve também" no carrinho. Mostra itens que costumam sair junto e ajudam
 * a completar o pedido.
 */
export default function Sugestoes() {
  const { itens, adicionar, pronto } = useCart();
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);

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

  if (sugestoes.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Leve também</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sugestoes.map((s) => (
          <li key={s.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <a href={`/produtos/${s.slug}`} className="block aspect-square bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.imagem && <img src={s.imagem} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </a>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <a href={`/produtos/${s.slug}`} className="line-clamp-2 text-xs font-semibold">{s.nome}</a>
              <p className="mt-auto text-sm font-bold">{formatarBRL(s.precoCentavos)}</p>
              <button
                className="btn-secundario h-9 w-full text-xs"
                onClick={() => {
                  adicionar({ id: s.id, slug: s.slug, nome: s.nome, precoCentavos: s.precoCentavos, imagem: s.imagem ?? undefined });
                  adicionarAoCarrinho({ id: s.id, nome: s.nome, precoCentavos: s.precoCentavos });
                }}
              >
                Adicionar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
