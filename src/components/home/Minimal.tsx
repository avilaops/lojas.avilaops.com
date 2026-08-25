import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";

/** Sem banner: slogan centralizado, categorias em linha, produtos em 3 colunas. Para catálogo enxuto. */
export default function Minimal({ t, identidade, categorias, vitrine, temDestaques, vende }: DadosHome) {
  return (
    <div className="home-minimal container-loja py-16 sm:py-24">
      <section className="mx-auto max-w-3xl text-center">
        <p className="home-selo text-primary">{t.nome}</p>
        <h1 className="mt-5 text-5xl font-semibold leading-[.96] tracking-[-.06em] sm:text-7xl">{t.slogan ?? t.nome}</h1>
        {(t.sobre || identidade.diferencial) && <p className="mt-3 text-muted-foreground line-clamp-2">{t.sobre || identidade.diferencial}</p>}
        {categorias.length > 0 && (
          <nav className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
            <Link href="/produtos" className="font-semibold underline-offset-4 hover:underline">Tudo</Link>
            {categorias.map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{c.nome}</Link>
            ))}
          </nav>
        )}
      </section>

      <section className="mt-12">
        {vitrine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Os produtos desta loja estão sendo cadastrados.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {vitrine.slice(0, 9).map((p) => <ProductCard key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} />)}
          </div>
        )}
        <div className="mt-8 text-center">
          <Link href="/produtos" className="btn-secundario">{temDestaques ? "Ver todos os produtos" : "Ver catálogo"}</Link>
        </div>
      </section>
    </div>
  );
}
