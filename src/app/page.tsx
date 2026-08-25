import Link from "next/link";
import { exigirTenant, lojaVende } from "@/lib/tenant";
import { listarCategorias, listarProdutos } from "@/lib/catalogo";
import ProductCard from "@/components/ProductCard";

export default async function Home() {
  const t = await exigirTenant();
  const [categorias, destaques] = await Promise.all([listarCategorias(t.id), listarProdutos(t.id, { destaque: true })]);
  const vitrine = destaques.length ? destaques : await listarProdutos(t.id);
  const vende = lojaVende(t);

  return (
    <div className="container-loja py-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-10 sm:py-16" style={t.bannerUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${t.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <h1 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t.slogan ?? t.nome}</h1>
        {t.sobre && <p className="mt-3 max-w-xl text-sm opacity-90 line-clamp-3">{t.sobre}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/produtos" className="inline-flex h-11 items-center rounded-lg bg-background px-5 text-sm font-semibold text-foreground">
            Ver produtos
          </Link>
          {t.retiradaNaLoja && <span className="inline-flex h-11 items-center text-sm opacity-90">Retire na loja sem custo</span>}
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold">Categorias</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categorias.map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="rounded-xl border border-border bg-card p-4 text-sm font-semibold hover:bg-muted">
                {c.nome}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">{destaques.length ? "Destaques" : "Produtos"}</h2>
          <Link href="/produtos" className="text-sm text-muted-foreground hover:text-foreground">
            Ver todos
          </Link>
        </div>
        {vitrine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Os produtos desta loja estão sendo cadastrados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 8).map((p) => (
              <ProductCard key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
