import Link from "next/link";
import { Search, Store } from "lucide-react";
import type { TenantPublico } from "@/lib/tenant";
import CartButton from "@/components/cart/CartButton";
import BuscaLoja from "@/components/BuscaLoja";

export default function Header({ loja, logoUrl, categorias }: { loja: TenantPublico; logoUrl: string | null; categorias: Array<{ slug: string; nome: string }> }) {
  return (
    <header className="cabecalho-loja sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container-loja flex h-[72px] items-center gap-4">
        <Link href="/" className="marca-loja flex items-center gap-2.5 font-bold" aria-label={loja.nome}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={loja.nome} className="h-9 w-auto" />
          ) : (
            <><span className="marca-loja-icone"><Store className="h-4 w-4" /></span><span className="text-lg tracking-tight">{loja.nome}</span></>
          )}
        </Link>

        <BuscaLoja />

        <Link href="/produtos" aria-label="Buscar produtos" className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-border md:hidden"><Search className="h-4 w-4" /></Link>
        {loja.vende && (
          <Link href="/conta" className="hidden h-10 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium sm:inline-flex" aria-label="Minha conta">
            Minha conta
          </Link>
        )}
        {loja.vende && <CartButton />}
      </div>

      {categorias.length > 0 && (
        <nav className="nav-loja border-t border-border">
          <div className="container-loja flex gap-6 overflow-x-auto py-2.5 text-[13px]">
            <Link href="/produtos" className="whitespace-nowrap font-semibold text-foreground">
              Todos
            </Link>
            {categorias.map((c) => (
              <Link key={c.slug} href={`/categoria/${c.slug}`} className="whitespace-nowrap text-muted-foreground hover:text-foreground">
                {c.nome}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
