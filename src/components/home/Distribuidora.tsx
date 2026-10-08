import Link from "next/link";
import { temaDo } from "@/lib/tenant";
import { ArrowRight, Search, Tags } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BannerCarousel from "./BannerCarousel";
import BeneficiosBarra from "./BeneficiosBarra";
import AtalhosCategorias from "./AtalhosCategorias";
import { campanhasDaLoja } from "@/lib/campanhas";
import type { DadosHome } from "./tipos";

/** Vitrine de campanha para lojas com artes promocionais e catálogo. */
export default function Distribuidora({ t, identidade, categorias, vitrine, temDestaques, vende, moto }: DadosHome) {
  const tema = temaDo(t);
  const motopecas = t.segmento === "motopecas";
  const campanhas = campanhasDaLoja(tema);
  const distribuidoraVisual = campanhas.length > 0 || Boolean(t.bannerUrl);

  if (distribuidoraVisual) {
    const banners = campanhas.length ? campanhas : [{ imagemUrl: t.bannerUrl!, link: "/produtos", alt: "Campanha da loja" }];
    return (
      <main className="home-mercado home-distribuidora home-campanhas">
        <h1 className="sr-only">{t.nome} — {t.slogan || "Catálogo de produtos"}</h1>
        <BannerCarousel campanhas={banners} />
        <section className="campanhas-categorias" aria-labelledby="categorias-titulo">
          <div className="container-loja"><h2 id="categorias-titulo">Compre por categoria</h2></div>
          <AtalhosCategorias categorias={categorias} semImagem={tema.categoriaSemImagem} />
        </section>
        <section className="container-loja campanhas-busca" aria-label="Busca no catálogo">
          <div><h2>Encontre a peça certa</h2><p>Busque por nome, código, referência ou marca. Para medidas, use diâmetro interno × externo × altura, em mm.</p></div>
          <Link href="/produtos" className="btn-secundario">Buscar e filtrar produtos <Search size={18} /></Link>
        </section>
        <section className="container-loja campanhas-produtos" aria-labelledby="produtos-titulo">
          <header><h2 id="produtos-titulo">{temDestaques ? "Destaques do catálogo" : "Explore nossos produtos"}</h2><Link href="/produtos">Ver catálogo completo <ArrowRight size={18} /></Link></header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 8).map(produto => <ProductCard loja={t} key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
          <Link href="/produtos" className="btn-primario campanhas-ver-todos">Ver todos os produtos <ArrowRight size={18} /></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="home-mercado home-distribuidora">
      <section className={`mercado-abertura${t.bannerUrl ? " mercado-abertura-com-banner" : ""}`}>
        <div className="container-loja mercado-abertura-grid">
          <div>
            <p className="home-selo text-primary">{motopecas ? "Distribuição especializada" : identidade.palavrasChave[0] || "Catálogo completo"}</p>
            <h1>{t.slogan ?? t.nome}</h1>
            <p>{t.sobre || identidade.diferencial || "Compare, escolha e peça sem perder tempo."}</p>
            <div className="mercado-acoes">
              <Link href="/produtos" className="btn-primario">Buscar produtos <Search /></Link>
              {t.whatsapp && <Link href="/contato" className="btn-secundario">Falar com a equipe</Link>}
            </div>
            <p className="mercado-dica">Encontre por nome, medida ou código do fabricante.</p>
          </div>
          {t.bannerUrl && (
            <aside className="distribuidora-arte">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.bannerUrl} alt="" />
            </aside>
          )}
        </div>
      </section>

      <AtalhosCategorias categorias={categorias} semImagem={tema.categoriaSemImagem} />
      <div className="container-loja"><BeneficiosBarra t={t} /></div>

      {categorias.length > 0 && (
        <section className="container-loja mercado-departamentos">
          <header><div><p className="home-selo text-primary"><Tags /> Departamentos</p><h2>{motopecas ? "Peças por conjunto" : "Compre por categoria"}</h2></div><Link href="/produtos">Todos os produtos <ArrowRight /></Link></header>
          <div className="mercado-grade-categorias">
            {categorias.slice(0, 10).map((categoria, indice) => (
              <Link key={categoria.id} href={`/categoria/${categoria.slug}`} className={indice === 0 ? "mercado-categoria-principal" : ""}>
                {categoria.imagemUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoria.imagemUrl} alt="" loading="lazy" />
                )}
                <span>{categoria.nome}</span><ArrowRight />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-loja mercado-produtos">
        <header><div><p className="home-selo text-primary">Seleção da loja</p><h2>{temDestaques ? "Destaques do catálogo" : "Produtos disponíveis"}</h2></div><Link href="/produtos">Ver tudo <ArrowRight /></Link></header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">Os primeiros produtos estão sendo organizados para esta vitrine.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {vitrine.slice(0, 10).map((produto) => <ProductCard loja={t} key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
        )}
      </section>
    </main>
  );
}
