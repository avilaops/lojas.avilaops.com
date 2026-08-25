import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";

/** Banner de ponta a ponta, chips de categoria, grade cheia. Para loja com muita foto. */
export default function Vitrine({ t, identidade, categorias, vitrine, temDestaques, vende }: DadosHome) {
  const banner = t.bannerUrl ?? vitrine.find((p) => p.imagens[0])?.imagens[0];
  return (
    <div className="home-vitrine">
      <section className="hero-vitrine relative flex min-h-[62vh] items-end bg-primary text-primary-foreground" style={banner ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.08)), url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <div className="container-loja pb-14 pt-28">
          <p className="home-selo">{identidade.personalidade[0]} · seleção {t.nome}</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-[.98] tracking-tight sm:text-7xl">{t.slogan ?? t.nome}</h1>
          {identidade.diferencial && <p className="mt-4 max-w-xl text-sm opacity-85">{identidade.diferencial}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/produtos" className="inline-flex h-11 items-center rounded-full bg-background px-6 text-sm font-semibold text-foreground">Comprar agora</Link>
            {t.freteGratisAcima != null && <span className="inline-flex h-11 items-center rounded-lg border border-white/40 px-4 text-sm">Frete grátis acima de R$ {(t.freteGratisAcima / 100).toFixed(0)}</span>}
          </div>
        </div>
      </section>

      {categorias.length > 0 && (
        <div className="border-b border-border bg-card">
          <div className="container-loja flex gap-2 overflow-x-auto py-3">
            {categorias.map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary hover:text-primary-foreground">{c.nome}</Link>
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
