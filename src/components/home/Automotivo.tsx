import Link from "@/components/LinkLoja";
import { temaDo } from "@/lib/tenant";
import { PRINCIPAIS } from "@/components/Header";
import { categoriasParaVitrine } from "@/lib/catalogo";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BeneficiosBarra from "./BeneficiosBarra";
import AtalhosCategorias from "./AtalhosCategorias";
import { montarTrilha } from "@/lib/trilha-automotiva";
import type { DadosHome } from "./tipos";

/**
 * Estética automotiva, autopeças de cuidado e oficina.
 *
 * O que este layout faz e nenhum outro faz: mostra o catálogo **na ordem do
 * serviço**. Lavar, corrigir, proteger. Não é enfeite de vitrine, é o erro mais
 * caro do ramo: quem passa cera em carro sujo sela a sujeira, quem poli sem
 * descontaminar risca a pintura. Quem chega para comprar o primeiro produto não
 * sabe disso, e a loja que ensina a ordem vende a etapa inteira em vez de um
 * frasco solto.
 *
 * A trilha é montada a partir das categorias que a loja já cadastrou, por
 * palavra no nome. Não inventa categoria que não existe e não obriga ninguém a
 * cadastrar de um jeito: loja que não tiver pelo menos duas etapas reconhecidas
 * simplesmente não mostra a trilha e cai na grade de categorias, igual aos
 * outros layouts. Uma autopeças que use este layout pelo resto não fica com uma
 * seção meio vazia na primeira tela.
 */

export default function Automotivo({ t, identidade, categorias, vitrine, temDestaques, vende, moto }: DadosHome) {
  const { trilha, restantes, mostrar: mostrarTrilha } = montarTrilha(categorias);
  const tema = temaDo(t);
  const categoriasDosAtalhos = new Set(
    categoriasParaVitrine(categorias, temaDo(t).categoriaSemImagem)
      .slice(0, PRINCIPAIS)
      .map((categoria) => categoria.id),
  );
  const categoriasAdicionais = restantes.filter((categoria) => !categoriasDosAtalhos.has(categoria.id));
  const bannerDesktopUrl = t.bannerUrl && `${t.bannerUrl}${t.bannerUrl.includes("?") ? "&" : "?"}v=2`;
  const bannerMobileUrl = bannerDesktopUrl?.replace(/-desktop(?=\.[a-z0-9]+(?:[?#]|$))/i, "-mobile");

  return (
    <main className="home-mercado home-automotivo">
      <section className={`mercado-abertura${t.bannerUrl ? " mercado-abertura-com-banner" : ""}`}>
        {t.bannerUrl ? (
          <Link href="/produtos" className="automotivo-banner">
            <picture>
              {bannerMobileUrl && bannerMobileUrl !== t.bannerUrl && (
                <source media="(max-width: 640px)" srcSet={bannerMobileUrl} />
              )}
              <img src={bannerDesktopUrl!} alt="" fetchPriority="high" />
            </picture>
            <div className="container-loja automotivo-banner-conteudo">
              <p className="home-selo">{t.nome}</p>
              <h1>{tema.heroTitulo || t.slogan || "Cuidado em cada detalhe"}</h1>
              {tema.heroTexto && <p className="automotivo-banner-resumo">{tema.heroTexto}</p>}
              <span className="btn-primario">Explorar produtos <ArrowRight aria-hidden="true" /></span>
            </div>
          </Link>
        ) : (
          <div className="container-loja mercado-abertura-grid">
            <div>
              <p className="home-selo text-primary">{identidade.palavrasChave[0] || "Estética automotiva"}</p>
              <h1>{t.slogan ?? t.nome}</h1>
              <p>{t.sobre || identidade.diferencial || "Os produtos e o passo a passo para o acabamento durar."}</p>
              <div className="mercado-acoes">
                <Link href="/produtos" className="btn-primario">Ver produtos <Search /></Link>
                {t.whatsapp && <Link href="/contato" className="btn-secundario">Tirar dúvida técnica</Link>}
              </div>
              <p className="mercado-dica">Busque por produto, marca ou volume.</p>
            </div>
            {t.bannerUrl && (
              <aside className="distribuidora-arte">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.bannerUrl} alt="" />
              </aside>
            )}
          </div>
        )}
      </section>

      <AtalhosCategorias categorias={categorias} semImagem={temaDo(t).categoriaSemImagem} destaque />

      <div className="container-loja"><BeneficiosBarra t={t} /></div>

      {mostrarTrilha && !t.bannerUrl && (
        <section className="container-loja automotivo-trilha">
          <header>
            <div>
              <p className="home-selo text-primary"><Sparkles /> Passo a passo</p>
              <h2>Na ordem certa, o resultado dura</h2>
            </div>
            <Link href="/produtos">Todos os produtos <ArrowRight /></Link>
          </header>
          <ol>
            {trilha.map((passo, indice) => (
              <li key={passo.chave}>
                <Link href={`/categoria/${passo.categoria.slug}`}>
                  <span className="automotivo-passo-numero" aria-hidden="true">{indice + 1}</span>
                  <span className="automotivo-passo-texto">
                    <strong>{passo.titulo}</strong>
                    <span>{passo.resumo}</span>
                    {/* O nome cadastrado aparece porque é ele que a pessoa vai
                        reencontrar no menu e na busca: "Corrigir" é o que ela
                        precisa fazer, "Polimento" é onde isso mora na loja. */}
                    <em>{passo.categoria.nome}</em>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {categoriasAdicionais.length > 0 && (
        <section className="container-loja mercado-departamentos">
          <header>
            <div>
              <p className="home-selo text-primary">{mostrarTrilha ? "Também na loja" : "Categorias"}</p>
              <h2>{mostrarTrilha ? "Acessórios, kits e o resto do catálogo" : "Compre por categoria"}</h2>
            </div>
            <Link href="/produtos">Ver tudo <ArrowRight /></Link>
          </header>
          <div className="mercado-grade-categorias">
            {categoriasAdicionais.slice(0, 10).map((categoria, indice) => (
              <Link key={categoria.id} href={`/categoria/${categoria.slug}`} className={indice === 0 && !mostrarTrilha ? "mercado-categoria-principal" : ""}>
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
        <header>
          <div>
            <p className="home-selo text-primary">Seleção da loja</p>
            <h2>{temDestaques ? "Destaques" : "Produtos disponíveis"}</h2>
          </div>
          <Link href="/produtos">Ver tudo <ArrowRight /></Link>
        </header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">Os primeiros produtos estão sendo organizados para esta vitrine.</p>
        ) : (
          <div className="automotivo-grade-produtos">
            {vitrine.slice(0, 12).map((produto) => <ProductCard loja={t} key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} compacto alternarImagem={false} />)}
          </div>
        )}
      </section>
    </main>
  );
}
