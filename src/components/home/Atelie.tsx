import type { ReactNode } from "react";
import Link from "@/components/LinkLoja";
import ProductCard from "@/components/ProductCard";
import { secoesDoAtelie, textoDoSobre, type SecaoAtelie } from "@/lib/atelie";
import { campanhasDaLoja } from "@/lib/campanhas";
import { categoriasParaVitrine } from "@/lib/catalogo";
import { temaDo, urlDaLoja } from "@/lib/tenant";
import BannerCarousel from "./BannerCarousel";
import type { DadosHome } from "./tipos";

/**
 * Home Ateliê. Cabeçalho, card, carrinho e rodapé são os da plataforma;
 * aqui só a composição da página inicial e o lookbook.
 *
 * Seção sem conteúdo não ocupa lugar: categoria sem foto (quando a loja
 * oculta), grade vazia, look incompleto e sobre em branco somem.
 */
export default function Atelie({ t, identidade, categorias, vitrine, temDestaques, vende, looks = [] }: DadosHome) {
  const tema = temaDo(t);
  const campanhas = campanhasDaLoja(tema);
  const categoriasVisiveis = categoriasParaVitrine(categorias, tema.categoriaSemImagem);
  const titulo = tema.heroTitulo?.trim() || t.slogan?.trim() || t.nome;
  const textoHero = tema.heroTexto?.trim() || "";
  const destino = tema.atelie?.heroLink || campanhas[0]?.link || "/produtos";
  const sobre = textoDoSobre(tema, t.sobre, identidade.diferencial);
  const selo = identidade.palavrasChave[0]?.trim() || "Moda";
  const secoes = secoesDoAtelie(tema);

  function hero() {
    const arte = campanhas.length > 1 ? (
      <BannerCarousel campanhas={campanhas} />
    ) : campanhas.length === 1 ? (
      <Link href={campanhas[0].link} className="atelie-hero-arte">
        <picture>
          {campanhas[0].imagemMobileUrl ? <source media="(max-width: 640px)" srcSet={campanhas[0].imagemMobileUrl} /> : null}
          <img src={campanhas[0].imagemUrl} alt={campanhas[0].alt} />
        </picture>
      </Link>
    ) : t.bannerUrl ? (
      <div className="atelie-hero-arte">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.bannerUrl} alt="" />
      </div>
    ) : null;

    return (
      <section className="atelie-secao atelie-hero" aria-labelledby="atelie-hero-titulo">
        {arte}
        <div className="atelie-hero-copy">
          <p className="home-selo">{selo}</p>
          <h1 id="atelie-hero-titulo">{titulo}</h1>
          {textoHero && <p>{textoHero}</p>}
          <Link href={destino} className="btn-primario">Ver agora</Link>
        </div>
      </section>
    );
  }

  function blocoCategorias() {
    if (categoriasVisiveis.length === 0) return null;
    return (
      <section className="atelie-secao" aria-labelledby="atelie-categorias-titulo">
        <h2 id="atelie-categorias-titulo">Categorias</h2>
        <div className="atelie-categorias">
          {categoriasVisiveis.slice(0, 8).map((categoria) => (
            <Link key={categoria.id} href={`/categoria/${categoria.slug}`} className="atelie-categoria">
              <span className="atelie-categoria-foto">
                {categoria.imagemUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoria.imagemUrl} alt="" loading="lazy" decoding="async" />
                )}
              </span>
              <span>{categoria.nome}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  function blocoDestaques() {
    if (vitrine.length === 0) return null;
    return (
      <section className="atelie-secao" aria-labelledby="atelie-destaques-titulo">
        <h2 id="atelie-destaques-titulo">{temDestaques ? "Mais vendidos" : "Produtos"}</h2>
        <div className="atelie-produtos">
          {vitrine.slice(0, 8).map((produto) => (
            <ProductCard loja={t} key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} />
          ))}
        </div>
      </section>
    );
  }

  function blocoLookbook() {
    if (looks.length === 0) return null;
    const base = urlDaLoja(t);
    const itens = [...new Map(looks.flatMap((look) => look.produtos).map((produto) => [produto.slug, produto])).values()];
    return (
      <section className="atelie-secao" aria-labelledby="atelie-lookbook-titulo">
        <h2 id="atelie-lookbook-titulo">Lookbook</h2>
        <div className="atelie-looks">
          {looks.map((look, indice) => (
            <figure key={`${look.titulo}-${indice}`} className="atelie-look">
              <Link href={`/produtos/${look.produtos[0].slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={look.imagem} alt={look.titulo} loading="lazy" decoding="async" />
              </Link>
              <figcaption>
                <span>{look.titulo}</span>
                <span aria-hidden="true"> · </span>
                {look.produtos.map((produto, ordem) => (
                  <span key={produto.slug}>
                    {ordem > 0 && " + "}
                    <Link href={`/produtos/${produto.slug}`}>{produto.nome}</Link>
                  </span>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `Lookbook · ${t.nome}`,
              itemListElement: itens.map((produto, indice) => ({
                "@type": "ListItem",
                position: indice + 1,
                name: produto.nome,
                url: `${base}/produtos/${produto.slug}`,
              })),
            }),
          }}
        />
      </section>
    );
  }

  function blocoSobre() {
    if (!sobre) return null;
    const paragrafos = sobre.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return (
      <section className="atelie-secao atelie-sobre" aria-labelledby="atelie-sobre-titulo">
        <h2 id="atelie-sobre-titulo">Sobre a {t.nome}</h2>
        {paragrafos.map((paragrafo) => <p key={paragrafo.slice(0, 48)}>{paragrafo}</p>)}
      </section>
    );
  }

  const blocos: Record<SecaoAtelie, () => ReactNode> = {
    hero,
    categorias: blocoCategorias,
    destaques: blocoDestaques,
    lookbook: blocoLookbook,
    sobre: blocoSobre,
  };

  return (
    <div className="home-atelie">
      <div className="container-loja atelie-miolo">
        {secoes.map((secao) => <div key={secao}>{blocos[secao]()}</div>)}
      </div>
    </div>
  );
}
