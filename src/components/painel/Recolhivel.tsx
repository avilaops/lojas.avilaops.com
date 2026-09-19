"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Um bloco de formulário que começa fechado.
 *
 * A tela do produto tinha 22 campos abertos ao mesmo tempo, numa coluna só no
 * celular: para trocar um preço o lojista rolava por GTIN, MPN e "Identificadores"
 * antes de chegar nele. Fechar o que é raro é o que devolve a tela ao tamanho
 * da tarefa.
 *
 * `<details>` de propósito, e não um estado em React: abre sem JavaScript, o
 * leitor de tela anuncia como grupo, e o `Ctrl+F` do navegador encontra o campo
 * escondido. É também o que deixa o botão "Corrigir" da conferência abrir o
 * bloco certo — ver `QualidadeProduto`.
 *
 * O `aviso` existe porque bloco fechado não pode esconder pendência: o que
 * falta continua visível na linha fechada.
 */
export default function Recolhivel({
  titulo,
  resumo,
  aviso,
  aberto,
  children,
}: {
  titulo: string;
  /** O que tem dentro, em três palavras. */
  resumo?: string;
  /** O que falta. Some no lugar do resumo, em âmbar. */
  aviso?: string | null;
  aberto?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={aberto} className="group min-w-0 rounded-xl border border-border">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
        <ChevronDown size={16} className="flex-none text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        <span className="min-w-0">{titulo}</span>
        {aviso ? (
          <span className="ml-auto flex-none rounded bg-amber-50 px-1.5 py-0.5 text-xs font-normal text-amber-800">{aviso}</span>
        ) : resumo ? (
          <span className="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground">{resumo}</span>
        ) : null}
      </summary>
      <div className="grid min-w-0 gap-4 border-t border-border p-4">{children}</div>
    </details>
  );
}
