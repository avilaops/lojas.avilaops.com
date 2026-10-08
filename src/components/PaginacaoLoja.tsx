import Link from "@/components/LinkLoja";

/**
 * Anterior / Próxima da vitrine pública.
 *
 * Links de verdade, não botões: o Google segue, o "voltar" do navegador
 * funciona e a página 3 tem endereço para mandar no WhatsApp. Quando a
 * listagem já contou o conjunto filtrado (`total`), a página diz "de N": quem
 * filtra o-ring por medida quer saber se sobraram duas páginas ou quarenta.
 *
 * Quem chama pede um item a mais do que mostra e passa `temProxima`: é o que
 * evita contar o catálogo inteiro só para saber se há mais uma página.
 */
export const POR_PAGINA = 48;

export { TAMANHOS_PAGINA, porPaginaDaUrl } from "@/lib/filtros-url";

export function paginaDaUrl(sp: Record<string, string | undefined>): number {
  return Math.max(1, Math.floor(Number(sp.pagina)) || 1);
}

/** O mesmo endereço com outro número de página, preservando os filtros. */
export function linkDaPagina(base: string, sp: Record<string, string | undefined>, n: number): string {
  const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1]) && e[0] !== "pagina"));
  if (n > 1) q.set("pagina", String(n));
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}`;
}

export default function PaginacaoLoja({
  base,
  sp,
  pagina,
  temProxima,
  total,
  porPagina = POR_PAGINA,
}: {
  base: string;
  sp: Record<string, string | undefined>;
  pagina: number;
  temProxima: boolean;
  /** Produtos no conjunto filtrado, quando a página já contou. */
  total?: number;
  porPagina?: number;
}) {
  const paginas = total != null ? Math.max(1, Math.ceil(total / porPagina)) : null;
  if (pagina <= 1 && !temProxima) return null;
  const apagado = "inline-flex h-11 items-center px-4 text-muted-foreground/50";
  return (
    <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-3 text-sm">
      {pagina > 1 ? (
        <Link href={linkDaPagina(base, sp, pagina - 1)} rel="prev" className="btn-secundario inline-flex h-11 items-center px-4">
          Anterior
        </Link>
      ) : (
        <span className={apagado}>Anterior</span>
      )}
      <span className="min-w-[6rem] text-center tabular-nums text-muted-foreground">Página {pagina}{paginas ? ` de ${paginas}` : ""}</span>
      {temProxima ? (
        <Link href={linkDaPagina(base, sp, pagina + 1)} rel="next" className="btn-secundario inline-flex h-11 items-center px-4">
          Próxima
        </Link>
      ) : (
        <span className={apagado}>Próxima</span>
      )}
    </nav>
  );
}
