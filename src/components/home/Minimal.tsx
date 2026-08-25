import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";

/** Sem banner: slogan centralizado, categorias em linha, produtos em 3 colunas. Para catálogo enxuto. */
export default function Minimal({ t, categorias, vitrine, temDestaques, vende }: DadosHome) {
  return (
    <div className="container-loja py-14">
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t.slogan ?? t.nome}</h1>
        {t.sobre && <p className="mt-3 text-muted-foreground line-clamp-2">{t.sobre}</p>}
        {categorias.length > 0 && (
          <nav className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
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
