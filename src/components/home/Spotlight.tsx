import Link from "next/link";
import { ArrowRight, Gauge, Wrench } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { formatarBRL } from "@/lib/catalogo";
import BeneficiosBarra from "./BeneficiosBarra";
import type { DadosHome } from "./tipos";

/** Impacto visual e um produto principal. Para marcas com boa fotografia. */
export default function Spotlight({ t, identidade, categorias, vitrine, temDestaques, vende, moto }: DadosHome) {
  const principal = vitrine[0];
  const imagem = t.bannerUrl ?? principal?.imagens[0];
  const motopecas = t.segmento === "motopecas";

  return (
    <main className="home-spotlight">
      <section className="spotlight-hero">
        {imagem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="spotlight-fundo" src={imagem} alt="" />
        )}
        <div className="spotlight-grade" aria-hidden="true" />
        <div className="container-loja spotlight-conteudo">
          <div className="spotlight-copy">
            <p className="home-selo">{motopecas ? "Performance que encaixa" : identidade.palavrasChave[0] || "Seleção especial"}</p>
            <h1>{t.slogan ?? t.nome}</h1>
            <p>{t.sobre || identidade.diferencial || "Produtos escolhidos para entregar confiança do primeiro clique até a entrega."}</p>
            <div className="spotlight-acoes">
              <Link href="/produtos" className="spotlight-cta">Explorar catálogo <ArrowRight /></Link>
              {motopecas && <span><Wrench /> Compatibilidade detalhada</span>}
            </div>
          </div>

          {principal && (
            <Link href={`/produtos/${principal.slug}`} className="spotlight-produto">
              <span className="home-selo">{temDestaques ? "Destaque da pista" : "Escolha da loja"}</span>
              <strong>{principal.nome}</strong>
              {principal.marca && <small>{principal.marca}</small>}
              <b>{formatarBRL(principal.precoCentavos)}</b>
              <i>Ver produto <ArrowRight /></i>
            </Link>
          )}
        </div>
      </section>

      <div className="container-loja"><BeneficiosBarra t={t} /></div>

      {categorias.length > 0 && (
        <section className="container-loja spotlight-categorias">
          <header><p className="home-selo text-primary">Rotas rápidas</p><h2>{motopecas ? "Encontre a peça pelo sistema da moto" : "Explore por categoria"}</h2></header>
          <div>
            {categorias.slice(0, 8).map((categoria, indice) => (
              <Link key={categoria.id} href={`/categoria/${categoria.slug}`}>
                <span>{String(indice + 1).padStart(2, "0")}</span>
                <strong>{categoria.nome}</strong>
                <ArrowRight />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-loja spotlight-vitrine">
        <header>
          <div><p className="home-selo text-primary"><Gauge /> Prontos para rodar</p><h2>{temDestaques ? "Peças em destaque" : "Produtos selecionados"}</h2></div>
          <Link href="/produtos">Ver catálogo completo <ArrowRight /></Link>
        </header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">O catálogo está sendo preparado. Volte em breve para ver os produtos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 8).map((produto) => <ProductCard key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
        )}
      </section>
    </main>
  );
}
