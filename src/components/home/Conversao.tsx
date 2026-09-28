import Link from "next/link";
import { ArrowRight, BadgeCheck, Bike, CircleDollarSign } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { formatarBRL } from "@/lib/catalogo";
import BeneficiosBarra from "./BeneficiosBarra";
import type { DadosHome } from "./tipos";

/** Oferta clara e caminho curto até a compra. Para campanhas e tráfego pago. */
export default function Conversao({ t, identidade, categorias, vitrine, temDestaques, vende, moto }: DadosHome) {
  const oferta = vitrine.find((produto) => produto.precoDeCentavos && produto.precoDeCentavos > produto.precoCentavos) ?? vitrine[0];
  const imagem = t.bannerUrl ?? oferta?.imagens[0];
  const motopecas = t.segmento === "motopecas";

  return (
    <main className="home-conversao">
      <section className="conversao-hero container-loja">
        <div className="conversao-copy">
          <p className="home-selo text-primary">{motopecas ? "A peça certa. Na primeira vez." : identidade.palavrasChave[0] || "Compra sem complicação"}</p>
          <h1>{t.slogan ?? t.nome}</h1>
          <p>{t.sobre || identidade.diferencial || "Escolha com confiança, compre com poucos cliques e acompanhe cada etapa."}</p>
          <div className="conversao-acoes">
            <Link href="/produtos" className="btn-primario">Encontrar minha peça <ArrowRight /></Link>
            {motopecas && <span><Bike /> Busca por moto e ano</span>}
          </div>
          <ul>
            <li><BadgeCheck /> Informações claras do produto</li>
            <li><CircleDollarSign /> Preço e frete antes de pagar</li>
          </ul>
        </div>
        <div className="conversao-visual">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt={oferta?.nome ?? t.nome} />
          ) : <div className="produto-sem-foto" />}
          {oferta && (
            <Link href={`/produtos/${oferta.slug}`} className="conversao-oferta">
              <small>{temDestaques ? "Oferta em destaque" : "Seleção da loja"}</small>
              <strong>{oferta.nome}</strong>
              <span>{formatarBRL(oferta.precoCentavos)}</span>
              <i>Conferir <ArrowRight /></i>
            </Link>
          )}
        </div>
      </section>

      <div className="container-loja"><BeneficiosBarra t={t} /></div>

      {categorias.length > 0 && (
        <nav className="container-loja conversao-categorias" aria-label="Categorias em destaque">
          <span>Comece por aqui</span>
          {categorias.slice(0, 6).map((categoria) => <Link key={categoria.id} href={`/categoria/${categoria.slug}`}>{categoria.nome}</Link>)}
          <Link href="/produtos">Ver tudo <ArrowRight /></Link>
        </nav>
      )}

      <section className="container-loja conversao-produtos">
        <header><div><p className="home-selo text-primary">Escolhas rápidas</p><h2>{motopecas ? "Peças para manter a moto rodando" : "Produtos em destaque"}</h2></div><Link href="/produtos">Explorar catálogo <ArrowRight /></Link></header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">Esta seleção está sendo preparada. O catálogo completo aparecerá aqui em breve.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 8).map((produto) => <ProductCard loja={t} key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
        )}
      </section>
    </main>
  );
}
