import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";

/** Texto de um lado, imagem do outro; categorias com foto; poucos destaques grandes; bloco "sobre". Para marca. */
export default function Editorial({ t, identidade, categorias, vitrine, temDestaques, vende }: DadosHome) {
  const imagem = t.bannerUrl ?? vitrine.find((p) => p.imagens[0])?.imagens[0];
  return (
    <div className="home-editorial container-loja py-10 sm:py-16">
      <section className="grid items-center gap-10 md:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <p className="home-selo text-primary">{identidade.palavrasChave[0] || "Curadoria"} · {t.nome}</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-7xl">{t.slogan ?? t.nome}</h1>
          {(t.sobre || identidade.diferencial) && <p className="mt-4 max-w-md text-muted-foreground line-clamp-4">{t.sobre || identidade.diferencial}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/produtos" className="btn-primario">Ver coleção</Link>
            <Link href="/sobre" className="btn-secundario">Nossa história</Link>
          </div>
        </div>
        <div className="imagem-editorial aspect-[4/5] overflow-hidden rounded-[calc(var(--radius)*3)] bg-muted md:aspect-[4/3]">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt={t.nome} className="h-full w-full object-cover" />
          ) : (
            <div className="placeholder-editorial flex h-full items-center justify-center bg-primary/10 text-sm text-muted-foreground">Sua imagem principal aparece aqui</div>
          )}
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="mt-14">
          <p className="home-selo text-primary">Curadoria</p><h2 className="mb-5 mt-2 text-2xl font-bold tracking-tight">Explore por categoria</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="group relative flex aspect-[16/9] items-end overflow-hidden rounded-2xl bg-muted p-4">
                {c.imagemUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imagemUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                )}
                <span className="relative rounded-lg bg-background/90 px-3 py-1.5 text-sm font-semibold">{c.nome}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">{temDestaques ? "Selecionados" : "Produtos"}</h2>
          <Link href="/produtos" className="text-sm text-muted-foreground hover:text-foreground">Ver todos</Link>
        </div>
        {vitrine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Os produtos desta loja estão sendo cadastrados.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {vitrine.slice(0, 6).map((p) => <ProductCard loja={t} key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} />)}
          </div>
        )}
      </section>

      {t.sobre && (
        <section className="mt-14 rounded-3xl bg-primary px-8 py-12 text-primary-foreground">
          <h2 className="text-2xl font-bold">Sobre a {t.nome}</h2>
          <p className="mt-3 max-w-2xl opacity-90">{t.sobre.split(/\n{2,}/)[0]}</p>
          <Link href="/sobre" className="mt-5 inline-flex h-11 items-center rounded-lg bg-background px-5 text-sm font-semibold text-foreground">Conhecer</Link>
        </section>
      )}
    </div>
  );
}
