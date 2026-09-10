import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CapaCategoria from "@/components/CapaCategoria";
import { exigirTenant, lojaVende, urlDaLoja } from "@/lib/tenant";
import { listarProdutos } from "@/lib/catalogo";
import PaginacaoLoja, { POR_PAGINA, paginaDaUrl } from "@/components/PaginacaoLoja";
import ProductCard from "@/components/ProductCard";
import { minhaMoto } from "@/lib/minha-moto";
import { nomeDaMoto } from "@/lib/motos";
import { buscarCategoriaPublica } from "@/lib/categorias";
import Trilha from "@/components/Trilha";
import { metadataDeListagem } from "@/lib/seo-listagem";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ marca?: string; modelo?: string; ano?: string; moto?: string; pagina?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const t = await exigirTenant();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const categoria = await buscarCategoriaPublica(t.id, slug);

  if (!categoria) {
    return {
      title: "Categoria não encontrada",
      robots: { index: false, follow: false },
    };
  }

  // Página N tem canonical próprio; filtro de moto vira noindex. Ver seo-listagem.
  return metadataDeListagem({
    base: `/categoria/${categoria.slug}`,
    sp,
    pagina: paginaDaUrl(sp),
    // O layout raiz acrescenta "· nome da loja" pelo template de título.
    title: categoria.seoTitle ?? categoria.nome,
    description: categoria.seoDescription ?? categoria.descricao ?? `Confira os produtos da categoria ${categoria.nome} na ${t.nome}.`,
    keywords: categoria.seoKeywords ?? undefined,
  });
}

export default async function Categoria({ params, searchParams }: Props) {
  const t = await exigirTenant();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const categoria = await buscarCategoriaPublica(t.id, slug);
  if (!categoria) notFound();
  const moto = t.segmento === "motopecas" ? await minhaMoto(sp) : null;
  // Paginado como /produtos: "Retentores" na Vedashow são 2.003 cards, e
  // mandar todos de uma vez é o que fazia a página demorar segundos.
  const pagina = paginaDaUrl(sp);
  const lote = await listarProdutos(t.id, { categoriaSlug: slug, moto, limite: POR_PAGINA + 1, pular: (pagina - 1) * POR_PAGINA });
  const produtos = lote.slice(0, POR_PAGINA);
  const temProxima = lote.length > POR_PAGINA;
  // Página além do fim é 404, não "nada encontrado" com 200: senão qualquer
  // ?pagina=999999 vira uma URL válida a mais para o Google guardar.
  if (produtos.length === 0 && pagina > 1) notFound();
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
      <PaginacaoLoja base={`/categoria/${categoria.slug}`} sp={sp} pagina={pagina} temProxima={temProxima} />
    </main>
  );
}
