import { Download } from "lucide-react";

/**
 * Baixar o que está na tela, em planilha.
 *
 * Um botão por formato em vez de um menu: são dois, e cada um resolve uma
 * coisa diferente — o .xlsx guarda o tipo da célula (código com zero à
 * esquerda continua código) e o .csv é o arquivo que volta pela importação.
 * Esconder essa escolha atrás de um menu suspenso acrescentaria um toque e um
 * alvo pequeno no celular, que é onde o lojista abre o painel.
 *
 * Os filtros da tela viajam na URL: quem está vendo "sem preço" baixa os sem
 * preço. Sem isso, o arquivo contradiz a tela que o gerou.
 */
export default function BaixarPlanilha({
  tipo,
  filtros = {},
  rotulo,
  ajuda,
}: {
  tipo: "produtos" | "pedidos" | "clientes";
  filtros?: Record<string, string | undefined>;
  rotulo: string;
  ajuda?: string;
}) {
  const endereco = (formato: "csv" | "xlsx") => {
    const p = new URLSearchParams({ tipo, formato });
    for (const [chave, valor] of Object.entries(filtros)) if (valor) p.set(chave, valor);
    return `/api/painel/exportar?${p}`;
  };

  return (
    <div className="grid gap-2">
      {/* O rótulo em linha própria: na mesma linha dos botões ele empurrava o
          "CSV" para baixo no celular, e os dois formatos apareciam separados
          como se fossem coisas diferentes. */}
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <div className="flex flex-wrap gap-2">
        <a href={endereco("xlsx")} className="btn-secundario inline-flex h-11 items-center gap-2 px-4 text-sm">
          <Download size={16} aria-hidden="true" /> Excel (.xlsx)
        </a>
        <a href={endereco("csv")} className="btn-secundario inline-flex h-11 items-center gap-2 px-4 text-sm">
          <Download size={16} aria-hidden="true" /> CSV
        </a>
      </div>
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
