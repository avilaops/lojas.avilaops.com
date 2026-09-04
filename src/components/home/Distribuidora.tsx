import Link from "next/link";
import { ArrowRight, Search, Tags } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BeneficiosBarra from "./BeneficiosBarra";
import AtalhosCategorias from "./AtalhosCategorias";
import type { DadosHome } from "./tipos";

/**
 * O catálogo denso do Mercado, com banner na abertura. Para distribuidores
 * que têm imagem de marca própria.
 *
 * Existe separado do Mercado porque o Mercado é o único layout que serve a
 * quem não tem banner nenhum: a abertura dele se sustenta na tipografia e nos
 * contadores. Quem tem a arte pronta perde essa abertura para uma imagem que
 * diz mais; quem não tem continua no Mercado, sem cair num retângulo vazio.
 */
export default function Distribuidora({ t, identidade, categorias, vitrine, temDestaques, vende, moto }: DadosHome) {
  const motopecas = t.segmento === "motopecas";

  return (
    <main className="home-mercado home-distribuidora">
      {/* O banner ocupa a metade direita da abertura, e não o fundo dela.
          Arte de banner de distribuidora vem com a chamada já desenhada
          ("A peça certa para sua manutenção"), então usá-la como fundo põe o
          título do layout por cima do título da imagem: dois textos brigando
          na primeira tela. Lado a lado, cada um se lê. */}
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
            {/* Ensina o gesto que a busca entende. Quem compra peça costuma ter
                a medida na mão e não imagina que dá para digitá-la. */}
            <p className="mercado-dica">Encontre por nome, medida ou código do fabricante.</p>
          </div>
          {/* Contagem de categorias e de itens não entra na vitrine.
              Dizer "5.591 itens" entrega o tamanho do estoque para quem quer
              comparar, e não ajuda ninguém a decidir a compra: quem procura
              peça quer a peça certa, não o tamanho do catálogo. */}
          {t.bannerUrl && (
            <aside className="distribuidora-arte">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.bannerUrl} alt="" />
            </aside>
          )}
        </div>
      </section>

      {/* Atalhos com foto logo abaixo da abertura, como no Mercado Livre: no
          celular é o que dá caminho a quem não vai digitar na busca. */}
      <AtalhosCategorias categorias={categorias} />

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
