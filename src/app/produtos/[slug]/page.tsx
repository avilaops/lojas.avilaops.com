import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirTenant, lojaVende, urlDaLoja } from "@/lib/tenant";
import { buscarProduto, formatarBRL } from "@/lib/catalogo";
import AddToCartButton from "@/components/cart/AddToCartButton";
import SeletorVariante from "@/components/SeletorVariante";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) return { title: "Produto" };
  return { title: p.nome, description: p.descricaoCurta ?? undefined, openGraph: { images: p.imagens.slice(0, 1) } };
}

export default async function ProdutoPage({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) notFound();
  const vende = lojaVende(t);
  const disponivel = p.disponibilidade !== "out_of_stock";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nome,
    ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.gtin ? { gtin: p.gtin } : {}),
    image: p.imagens,
    description: p.descricaoCurta ?? p.descricao ?? undefined,
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
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/">Início</Link> / <Link href="/produtos">Produtos</Link>
        {p.categoria && (
          <>
            {" "}/ <Link href={`/categoria/${p.categoria.slug}`}>{p.categoria.nome}</Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid gap-2">
          <div className="aspect-square overflow-hidden rounded-xl bg-muted">
            {p.imagens[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagens[0]} alt={p.nome} className="h-full w-full object-cover" />
            ) : null}
          </div>
          {p.imagens.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {p.imagens.slice(1, 6).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img} src={img} alt="" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>

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
    </div>
  );
}
