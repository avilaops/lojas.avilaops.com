"use client";

import { Search, X } from "lucide-react";

/**
 * Busca e filtros do topo de uma lista.
 *
 * No celular os filtros viram fichas que rolam de lado, não um select por
 * pergunta: escolher "esgotados" tem que ser um toque, não abrir um menu do
 * sistema, escolher e fechar.
 *
 * As opções respondem à pergunta do dia ("o que está esgotado?"), não a um
 * campo do banco.
 */
export type Ficha = { valor: string; rotulo: string };

export default function Filtros({
  busca,
  aoBuscar,
  exemplo,
  fichas,
  ativa,
  aoEscolher,
  extra,
}: {
  busca: string;
  aoBuscar: (v: string) => void;
  /** Placeholder com exemplo real, que ensina o gesto que a busca entende. */
  exemplo?: string;
  fichas?: Ficha[];
  ativa?: string;
  aoEscolher?: (v: string) => void;
  /** Um select a mais (categoria, por exemplo). */
  extra?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {/* No celular a busca fica sozinha na linha: dividindo com o select de
          categoria, ela cortava em "Nome, co" e nenhum dos dois cabia. */}
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-base outline-none sm:text-sm"
            value={busca}
            onChange={(e) => aoBuscar(e.target.value)}
            placeholder={exemplo ?? "Buscar"}
            aria-label="Buscar"
          />
          {busca && (
            <button
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              onClick={() => aoBuscar("")}
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {extra}
      </div>

      {fichas && fichas.length > 0 && aoEscolher && (
        // Rola de lado sem barra: a ficha ativa fica destacada e o toque tem
        // 40px de altura, não os 17px do link sublinhado que havia antes.
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {fichas.map((f) => {
            const escolhida = (ativa ?? "") === f.valor;
            return (
              <button
                key={f.valor}
                onClick={() => aoEscolher(f.valor)}
                aria-pressed={escolhida}
                className={`inline-flex h-11 flex-none items-center rounded-full border px-4 text-sm transition ${
                  escolhida
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.rotulo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
