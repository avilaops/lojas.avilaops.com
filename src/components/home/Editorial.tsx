import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { DadosHome } from "./tipos";

/** Texto de um lado, imagem do outro; categorias com foto; poucos destaques grandes; bloco "sobre". Para marca. */
export default function Editorial({ t, categorias, vitrine, temDestaques, vende }: DadosHome) {
  const imagem = t.bannerUrl ?? vitrine.find((p) => p.imagens[0])?.imagens[0];
  return (
    <div className="container-loja py-10">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t.nome}</p>
          <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">{t.slogan ?? t.nome}</h1>
          {t.sobre && <p className="mt-4 max-w-md text-muted-foreground line-clamp-4">{t.sobre}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/produtos" className="btn-primario">Ver coleção</Link>
            <Link href="/sobre" className="btn-secundario">Nossa história</Link>
          </div>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt={t.nome} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-primary/10 text-sm text-muted-foreground">Envie um banner no painel</div>
          )}
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-lg font-bold">Explore por categoria</h2>
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
            {vitrine.slice(0, 6).map((p) => <ProductCard key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} />)}
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
