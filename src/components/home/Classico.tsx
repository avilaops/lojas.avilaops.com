import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";
import { retiradaPublicaDisponivel } from "@/lib/tenant";

export default function Classico({ t, identidade, categorias, vitrine, temDestaques, vende }: DadosHome) {
  return (
    <div className="home-classico container-loja py-8 sm:py-10">
      <section className="hero-loja hero-classico relative overflow-hidden rounded-[calc(var(--radius)*2.4)] bg-primary px-6 py-16 text-primary-foreground sm:px-12 sm:py-24" style={t.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.7), rgba(0,0,0,.16)), url(${t.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <p className="home-selo">{identidade.palavrasChave[0] || "Bem-vindo"} · {t.nome}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{t.slogan ?? t.nome}</h1>
        {(t.sobre || identidade.diferencial) && <p className="mt-3 max-w-xl text-sm opacity-90 line-clamp-3">{t.sobre || identidade.diferencial}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/produtos" className="inline-flex h-11 items-center rounded-full bg-background px-6 text-sm font-semibold text-foreground transition hover:-translate-y-0.5">Explorar produtos</Link>
          {retiradaPublicaDisponivel(t) && <span className="inline-flex h-11 items-center text-sm opacity-90">Retire na loja sem custo</span>}
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="mt-10">
          <p className="home-selo text-primary">Encontre seu caminho</p><h2 className="mb-5 mt-2 text-2xl font-bold tracking-tight">Explore por categoria</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categorias.map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="categoria-classica rounded-xl border border-border bg-card p-5 text-sm font-semibold">{c.nome}<span>→</span></Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">{temDestaques ? "Destaques" : "Produtos"}</h2>
          <Link href="/produtos" className="text-sm text-muted-foreground hover:text-foreground">Ver todos</Link>
        </div>
        {vitrine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Os produtos desta loja estão sendo cadastrados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 8).map((p) => <ProductCard loja={t} key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} />)}
          </div>
        )}
      </section>
    </div>
  );
}
