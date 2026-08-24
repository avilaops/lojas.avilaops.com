import Link from "next/link";
import { Search } from "lucide-react";
import type { TenantPublico } from "@/lib/tenant";
import CartButton from "@/components/cart/CartButton";

export default function Header({ loja, logoUrl, categorias }: { loja: TenantPublico; logoUrl: string | null; categorias: Array<{ slug: string; nome: string }> }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="container-loja flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold" aria-label={loja.nome}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={loja.nome} className="h-9 w-auto" />
          ) : (
            <span className="text-lg">{loja.nome}</span>
          )}
        </Link>

        <form action="/produtos" className="ml-auto hidden max-w-sm flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 md:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input name="q" placeholder="Buscar produto" className="h-10 w-full bg-transparent text-sm outline-none" />
        </form>

        {loja.vende && <CartButton />}
      </div>

      {categorias.length > 0 && (
        <nav className="border-t border-border">
          <div className="container-loja flex gap-5 overflow-x-auto py-2 text-sm">
            <Link href="/produtos" className="whitespace-nowrap font-semibold">
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
