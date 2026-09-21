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

  // A Vedashow usa as chamadas comerciais dentro das artes e abre a home
  // diretamente nas campanhas, categorias e produtos.
  if (campanhas.length > 0) {
    return (
      <main className="home-mercado home-distribuidora home-campanhas">
        <BannerCarousel campanhas={campanhas.map(({ imagemUrl, imagemMobileUrl, link, alt }) => ({ imagemUrl, imagemMobileUrl, link, alt }))} />
        <AtalhosCategorias categorias={categorias} semImagem={tema.categoriaSemImagem} />
        {vitrine.length > 0 && (
          <section className="container-loja campanhas-produtos" aria-label="Produtos em destaque">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {vitrine.slice(0, 10).map((produto) => <ProductCard key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
            </div>
          </section>
        )}
      </main>
    );
  }
  if (distribuidoraVisual) {
    const bannerFallback = t.bannerUrl?.endsWith("/campanha-geral-v2.webp")
      ? "/media/vedashow/campanha-geral-v3-desktop.svg"
      : t.bannerUrl;
    return (
      <main className="home-mercado home-distribuidora home-campanhas">
        {bannerFallback && <BannerCarousel campanhas={[{ imagemUrl: bannerFallback, imagemMobileUrl: bannerFallback.endsWith("campanha-geral-v3-desktop.svg") ? "/media/vedashow/campanha-geral-v3-mobile.svg" : undefined, link: "/produtos", alt: "Campanha da loja" }]} />}
        <AtalhosCategorias categorias={categorias} semImagem={tema.categoriaSemImagem} />
        {vitrine.length > 0 && (
          <section className="container-loja campanhas-produtos" aria-label="Produtos">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {vitrine.slice(0, 10).map((produto) => <ProductCard key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
            </div>
          </section>
        )}
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
        <header><div><p className="home-selo text-primary">Seleção da distribuidora</p><h2>{temDestaques ? "Destaques do catálogo" : "Produtos disponíveis"}</h2></div><Link href="/produtos">Ver tudo <ArrowRight /></Link></header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">Os primeiros produtos estão sendo organizados para esta vitrine.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {vitrine.slice(0, 10).map((produto) => <ProductCard key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
        )}
      </section>
    </main>
  );
}
