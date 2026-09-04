"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Rodapé de página, com alvo de toque de sobra.
 *
 * Existe porque "renderizar tudo" é o defeito mais caro do painel: o Inventário
 * mandava 500 linhas de uma vez e a tela ficava com 19.672px de altura.
 */
export default function Paginacao({
  pagina,
  paginas,
  total,
  porPagina,
  ocupado,
  aoMudar,
  substantivo = "registros",
}: {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  ocupado?: boolean;
  aoMudar: (p: number) => void;
  /** "produtos", "pedidos", "clientes" — a tela sabe o que está listando. */
  substantivo?: string;
}) {
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  return (
    <div className="grid gap-3 pt-2">
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        {total === 0 ? (
          `Nenhum ${substantivo.replace(/s$/, "")} encontrado.`
        ) : (
          <>
            Mostrando <b>{primeiro}–{ultimo}</b> de <b>{total.toLocaleString("pt-BR")}</b> {substantivo}.
          </>
        )}
      </p>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-secundario inline-flex h-11 items-center gap-1 px-4 text-sm disabled:opacity-40"
            disabled={pagina <= 1 || ocupado}
            onClick={() => aoMudar(pagina - 1)}
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="min-w-[7rem] text-center text-sm tabular-nums text-muted-foreground">
            Página {pagina} de {paginas}
          </span>
          <button
            className="btn-secundario inline-flex h-11 items-center gap-1 px-4 text-sm disabled:opacity-40"
            disabled={pagina >= paginas || ocupado}
            onClick={() => aoMudar(pagina + 1)}
          >
            <span className="hidden sm:inline">Próxima</span> <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
