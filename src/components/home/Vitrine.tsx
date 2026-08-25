import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";

/** Banner de ponta a ponta, chips de categoria, grade cheia. Para loja com muita foto. */
export default function Vitrine({ t, categorias, vitrine, temDestaques, vende }: DadosHome) {
  const banner = t.bannerUrl ?? vitrine.find((p) => p.imagens[0])?.imagens[0];
  return (
    <div>
      <section className="relative flex min-h-[46vh] items-end bg-primary text-primary-foreground" style={banner ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.7), rgba(0,0,0,.15)), url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <div className="container-loja pb-10 pt-24">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{t.slogan ?? t.nome}</h1>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/produtos" className="inline-flex h-11 items-center rounded-lg bg-background px-6 text-sm font-semibold text-foreground">Comprar agora</Link>
            {t.freteGratisAcima != null && <span className="inline-flex h-11 items-center rounded-lg border border-white/40 px-4 text-sm">Frete grátis acima de R$ {(t.freteGratisAcima / 100).toFixed(0)}</span>}
          </div>
        </div>
      </section>

      {categorias.length > 0 && (
        <div className="border-b border-border bg-card">
          <div className="container-loja flex gap-2 overflow-x-auto py-3">
            {categorias.map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="whitespace-nowrap rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-primary hover:text-primary-foreground">{c.nome}</Link>
            ))}
          </div>
        </div>
      )}

      <section className="container-loja py-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-bold">{temDestaques ? "Destaques" : "Produtos"}</h2>
          <Link href="/produtos" className="text-sm text-muted-foreground hover:text-foreground">Ver todos</Link>
        </div>
        {vitrine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Os produtos desta loja estão sendo cadastrados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 12).map((p) => <ProductCard key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} />)}
          </div>
        )}
      </section>
    </div>
  );
}
