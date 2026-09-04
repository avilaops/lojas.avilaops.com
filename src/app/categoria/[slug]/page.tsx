import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CapaCategoria from "@/components/CapaCategoria";
import { exigirTenant, lojaVende, urlDaLoja } from "@/lib/tenant";
import { listarProdutos } from "@/lib/catalogo";
import ProductCard from "@/components/ProductCard";
import { minhaMoto } from "@/lib/minha-moto";
import { nomeDaMoto } from "@/lib/motos";
import { buscarCategoriaPublica } from "@/lib/categorias";
import Trilha from "@/components/Trilha";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ marca?: string; modelo?: string; ano?: string; moto?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await exigirTenant();
  const { slug } = await params;
  const categoria = await buscarCategoriaPublica(t.id, slug);

  if (!categoria) {
    return {
      title: "Categoria não encontrada",
      robots: { index: false, follow: false },
    };
  }

  return {
    // O layout raiz acrescenta "· nome da loja" pelo template de título.
    title: categoria.seoTitle ?? categoria.nome,
    description: categoria.seoDescription ?? categoria.descricao ?? `Confira os produtos da categoria ${categoria.nome} na ${t.nome}.`,
    keywords: categoria.seoKeywords,
    alternates: { canonical: `/categoria/${categoria.slug}` },
  };
}

export default async function Categoria({ params, searchParams }: Props) {
  const t = await exigirTenant();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const categoria = await buscarCategoriaPublica(t.id, slug);
  if (!categoria) notFound();
  const moto = t.segmento === "motopecas" ? await minhaMoto(sp) : null;
  const produtos = await listarProdutos(t.id, { categoriaSlug: slug, moto });
  const vende = lojaVende(t);

  return (
    <main className="container-loja py-8">
      <Trilha base={urlDaLoja(t)} itens={[{ nome: "Produtos", href: "/produtos" }, { nome: categoria.nome }]} />
      <CapaCategoria
        nome={categoria.nome}
        descricao={categoria.descricao}
        imagemUrl={categoria.imagemUrl}
        fotoDoPrimeiroProduto={produtos.find((p) => p.imagens[0])?.imagens[0] ?? null}
      />
      <p className="mb-6 text-sm text-muted-foreground">
        {moto ? (
          <>
            Mostrando o que serve na {nomeDaMoto(moto)} ·{" "}
            <Link href={`/produtos?categoria=${categoria.slug}&moto=todas`} className="underline">
              ver tudo desta categoria
            </Link>
          </>
        ) : null}
      </p>

      {produtos.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center" aria-labelledby="categoria-vazia-titulo">
          <h2 id="categoria-vazia-titulo" className="font-semibold">Nenhum produto encontrado</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {moto
              ? `Não encontramos produtos desta categoria compatíveis com ${nomeDaMoto(moto)}.`
              : "Ainda não há produtos disponíveis nesta categoria."}
          </p>
          {moto && (
            <Link href={`/produtos?categoria=${categoria.slug}&moto=todas`} className="btn-secundario mt-5">
              Ver todos os produtos desta categoria
            </Link>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((produto) => (
            <ProductCard key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />
          ))}
        </div>
      )}
    </main>
  );
}
