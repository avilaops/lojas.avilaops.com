import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Lista de navegação agrupada (Configurações › Marca › …).
 *
 * Substitui a barra horizontal de abas no celular. A barra tinha sete itens e
 * terminava cortada em 393px: para descobrir "Recebimento" a pessoa precisava
 * arrastar uma navegação que não dá sinal de que continua, e depois arrastar de
 * volta para trocar de seção.
 *
 * Aqui cada opção é uma linha inteira com o nome e o que ela faz, e entra numa
 * página própria. É o padrão de lista → detalhe → voltar, que no celular vence
 * aba rolável em qualquer medida.
 */
export type ItemAgrupado = {
  href: string;
  titulo: string;
  /** O que a pessoa resolve ali, na língua dela. */
  descricao?: string;
  /** Estado curto à direita: "Conectado", "Falta configurar". */
  estado?: React.ReactNode;
};

export default function ListaAgrupada({
  grupos,
}: {
  grupos: Array<{ titulo?: string; itens: ItemAgrupado[] }>;
}) {
  return (
    <div className="grid gap-6">
      {grupos.map((grupo, i) => (
        <section key={grupo.titulo ?? i}>
          {grupo.titulo && (
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.titulo}
            </h2>
          )}
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {grupo.itens.map((item, j) => (
              <li key={item.href} className={j > 0 ? "border-t border-border" : undefined}>
                <Link
                  href={item.href}
                  className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition active:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.titulo}</span>
                    {item.descricao && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.descricao}</span>
                    )}
                  </span>
                  {item.estado && <span className="flex-none text-xs text-muted-foreground">{item.estado}</span>}
                  <ChevronRight size={16} className="flex-none text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
