import type { ComponentPropsWithoutRef } from "react";
import Link from "@/components/LinkLoja";
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock } from "lucide-react";
import { CONTEUDOS_DOMIRIO } from "@/content/domirio/carregar";
import { navegacaoArtigoDomiRio, type ArtigoDomiRio as Artigo } from "@/lib/artigos-domirio";
import styles from "./editorial.module.css";

export default async function ArtigoDomiRio({ artigo, baseUrl }: { artigo: Artigo; baseUrl: string }) {
  const carregar = CONTEUDOS_DOMIRIO[artigo.slug as keyof typeof CONTEUDOS_DOMIRIO];
  const { default: Conteudo } = await carregar();
  const navegacao = navegacaoArtigoDomiRio(artigo.slug);
  const url = `${baseUrl}/blog/${artigo.slug}`;
  const h2 = ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => {
    const secao = artigo.sections.find(s => s.title === String(children));
    return <h2 {...props} id={secao?.id}>{children}</h2>;
  };

  return <div className={styles.shell}>
    <nav className={styles.migalhas} aria-label="Caminho da página"><Link href="/">Domi-Rio</Link><span aria-hidden="true">/</span><Link href="/blog">Central de conteúdo</Link><span aria-hidden="true">/</span><span>{artigo.category}</span></nav>
    <article>
      <header className={styles.cabecalhoArtigo}>
        <p className={styles.sobreTitulo}>{artigo.category}</p>
        <h1>{artigo.title}</h1>
        <p className={styles.metadados}><span>Equipe Domi-Rio</span><span><Clock size={15} aria-hidden="true" /> {artigo.readingMinutes} min de leitura</span><span>Guia {String(artigo.order).padStart(2, "0")} de 50</span></p>
      </header>
      <figure className={styles.capaArtigo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artigo.cover} alt={artigo.coverAlt} width={1200} height={700} fetchPriority="high" />
      </figure>
      <div className={styles.leitura}>
        <aside className={styles.sumario}>
          <nav aria-label="Neste artigo"><h2>Neste artigo</h2><ol>{artigo.sections.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol></nav>
          <Link href="/blog"><ArrowLeft size={15} aria-hidden="true" /> Ver todos os artigos</Link>
        </aside>
        <div className={styles.corpo}><Conteudo components={{ h2 }} /></div>
      </div>
    </article>
    <nav className={styles.anteriorProximo} aria-label="Navegar entre os 50 artigos">
      {navegacao.anterior ? <Link href={`/blog/${navegacao.anterior.slug}`}><span><ArrowLeft size={15} aria-hidden="true" /> Artigo anterior</span><strong>{navegacao.anterior.title}</strong></Link> : <Link href="/blog"><span><ArrowLeft size={15} aria-hidden="true" /> Central Domi-Rio</span><strong>Explorar todos os assuntos</strong></Link>}
      {navegacao.proximo && <Link href={`/blog/${navegacao.proximo.slug}`}><span>Próximo artigo <ArrowRight size={15} aria-hidden="true" /></span><strong>{navegacao.proximo.title}</strong></Link>}
    </nav>
    <section className={styles.outros} aria-labelledby="relacionados-domi-rio"><p className={styles.sobreTitulo}>Continue a leitura</p><h2 id="relacionados-domi-rio">Mais sobre {artigo.category.toLocaleLowerCase("pt-BR")}</h2><ul className={styles.relacionados}>{navegacao.relacionados.map(p => <li key={p.slug}><Link href={`/blog/${p.slug}`}><span>{p.readingMinutes} min de leitura</span><h3>{p.title}</h3><ArrowUpRight size={20} aria-hidden="true" /></Link></li>)}</ul></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "Article", headline: artigo.title, description: artigo.description,
      image: new URL(artigo.cover, baseUrl).href, articleSection: artigo.category, inLanguage: "pt-BR",
      author: { "@type": "Organization", name: "Domi-Rio" }, publisher: { "@type": "Organization", name: "Domi-Rio" }, mainEntityOfPage: url,
    }).replace(/</g, "\\u003c") }} />
  </div>;
}
