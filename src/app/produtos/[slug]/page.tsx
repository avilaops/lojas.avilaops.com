import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirTenant, lojaVende, urlDaLoja } from "@/lib/tenant";
import { buscarProduto, formatarBRL, listarProdutos, resumoAvaliacoes } from "@/lib/catalogo";
import AddToCartButton from "@/components/cart/AddToCartButton";
import SeletorVariante from "@/components/SeletorVariante";
import GaleriaProduto from "@/components/GaleriaProduto";
import Avaliacoes from "@/components/Avaliacoes";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) return { title: "Produto" };
  return { title: p.nome, description: p.descricaoCurta ?? undefined, alternates: { canonical: `/produtos/${p.slug}` }, openGraph: { images: p.imagens.slice(0, 1) } };
}

export default async function ProdutoPage({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) notFound();
  const vende = lojaVende(t);
  const disponivel = p.disponibilidade !== "out_of_stock";
  const [avaliacoes, resumo, relacionados] = await Promise.all([
    prisma.avaliacao.findMany({ where: { produtoId: p.id, aprovada: true }, orderBy: { criadoEm: "desc" }, take: 20 }),
    resumoAvaliacoes(p.id),
    listarProdutos(t.id, { categoriaSlug: p.categoria?.slug, excetoId: p.id, limite: 4 }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nome,
    ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.gtin ? { gtin: p.gtin } : {}),
    image: p.imagens,
    description: p.descricaoCurta ?? p.descricao ?? undefined,
    ...(resumo.media != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: resumo.media, reviewCount: resumo.total } } : {}),
    offers: {
      "@type": "Offer",
      url: `${urlDaLoja(t)}/produtos/${p.slug}`,
      priceCurrency: "BRL",
      price: (p.precoCentavos / 100).toFixed(2),
      availability: `https://schema.org/${p.disponibilidade === "in_stock" ? "InStock" : p.disponibilidade === "backorder" ? "BackOrder" : "OutOfStock"}`,
      seller: { "@id": `${urlDaLoja(t)}/#organization` },
    },
  };

  return (
    <div className="container-loja py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: urlDaLoja(t) },
          { "@type": "ListItem", position: 2, name: "Produtos", item: `${urlDaLoja(t)}/produtos` },
          ...(p.categoria ? [{ "@type": "ListItem", position: 3, name: p.categoria.nome, item: `${urlDaLoja(t)}/categoria/${p.categoria.slug}` }] : []),
          { "@type": "ListItem", position: p.categoria ? 4 : 3, name: p.nome, item: `${urlDaLoja(t)}/produtos/${p.slug}` },
        ],
      }) }} />
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/">Início</Link> / <Link href="/produtos">Produtos</Link>
        {p.categoria && (
          <>
            {" "}/ <Link href={`/categoria/${p.categoria.slug}`}>{p.categoria.nome}</Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <GaleriaProduto imagens={p.imagens} alt={p.nome} />

        <div>
          {p.marca && <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.marca}</p>}
          <h1 className="mt-1 text-2xl font-bold">{p.nome}</h1>
          {p.descricaoCurta && <p className="mt-2 text-sm text-muted-foreground">{p.descricaoCurta}</p>}

          {p.opcoes.length > 0 ? (
            <div className="mt-5 max-w-sm">
              {p.precoDeCentavos && p.precoDeCentavos > p.precoCentavos && <p className="text-sm text-muted-foreground line-through">{formatarBRL(p.precoDeCentavos)}</p>}
              <SeletorVariante
                produto={{ id: p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] }}
                opcoes={p.opcoes}
                variantes={p.variantes.map((v) => ({ id: v.id, nome: v.nome, valores: v.valores as Record<string, string>, precoCentavos: v.precoCentavos, estoque: v.estoque, imagem: v.imagem }))}
                vende={vende}
              />
            </div>
          ) : (
          <div className="mt-5">
            {p.precoDeCentavos && p.precoDeCentavos > p.precoCentavos && <p className="text-sm text-muted-foreground line-through">{formatarBRL(p.precoDeCentavos)}</p>}
            <p className="text-3xl font-bold">{formatarBRL(p.precoCentavos)}</p>
            {vende && t.meiosPagamento.includes("pix") && <p className="text-xs text-muted-foreground">no PIX, cartão ou boleto</p>}
          </div>
          )}

          <div className="mt-6 max-w-sm">
            {p.opcoes.length > 0 ? null : vende ? (
              <AddToCartButton item={{ id: p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] }} disponivel={disponivel && (p.estoque == null || p.estoque > 0)} irParaCarrinho />
            ) : t.whatsapp ? (
              <a className="btn-primario w-full" href={linkWhatsApp(t.whatsapp, `Olá! Tenho interesse em: ${p.nome}`)} target="_blank" rel="noopener">
                Pedir pelo WhatsApp
              </a>
            ) : null}
          </div>

          <ul className="mt-6 space-y-1 text-sm text-muted-foreground">
            {t.retiradaNaLoja && <li>✔ Retirada na loja sem custo</li>}
            <li>✔ Envio em até {t.despachoDiasUteis} dia(s) útil(eis) após o pagamento</li>
            {t.freteGratisAcima != null && <li>✔ Frete grátis acima de {formatarBRL(t.freteGratisAcima)}</li>}
            {p.sku && <li className="text-xs">SKU {p.sku}</li>}
          </ul>

          {p.descricao && (
            <section className="prosa mt-8 text-sm leading-relaxed">
              <h2 className="mb-2 text-base font-bold">Descrição</h2>
              {p.descricao.split(/\n{2,}/).map((par, i) => (
                <p key={i}>{par}</p>
              ))}
            </section>
          )}
        </div>
      </div>

      <Avaliacoes
        produtoId={p.id}
        avaliacoes={avaliacoes.map((a) => ({ id: a.id, nome: a.nome, nota: a.nota, texto: a.texto, criadoEm: a.criadoEm.toISOString() }))}
        media={resumo.media}
        total={resumo.total}
      />

      {relacionados.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-base font-bold">Você também pode gostar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relacionados.map((r) => <ProductCard key={r.id} produto={r} vende={vende} whatsapp={t.whatsapp} />)}
          </div>
        </section>
      )}
    </div>
  );
}
