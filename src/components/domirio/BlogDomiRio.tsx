import Link from "@/components/LinkLoja";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { artigosDomiRio } from "@/lib/artigos-domirio";
import { dataLegivel, type PublicacaoResumo } from "@/lib/publicacoes";
import IndiceArtigos from "./IndiceArtigos";
import styles from "./editorial.module.css";

export default function BlogDomiRio({ publicacoes }: { publicacoes: PublicacaoResumo[] }) {
  const artigos = artigosDomiRio("domi-rio");
  const existentes = publicacoes.filter(p => !artigos.some(a => a.slug === p.slug));
  return <div className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p className={styles.sobreTitulo}><BookOpen size={16} aria-hidden="true" /> Central Domi-Rio</p>
        <h1>Informação para começar pela decisão certa.</h1>
        <p className={styles.descricao}>Do reconhecimento do problema ao planejamento do manejo. Orientações sobre defensivos, aplicação, segurança e tecnologia no campo.</p>
        <a href="#defensivos" className={styles.linkDestaque}>Explorar os artigos <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
      <div className={styles.heroImagem}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/domirio/blog/01-fundamentos.webp" alt="Pessoa inspeciona plantas em uma lavoura ao amanhecer" width={960} height={600} fetchPriority="high" />
        <p><strong>Herbicida, inseticida ou fungicida?</strong><span>Saiba o que observar antes de pesquisar a categoria do produto.</span></p>
      </div>
    </header>
    <IndiceArtigos artigos={artigos} />
    {existentes.length > 0 && <section className={styles.outros} aria-labelledby="outros-guias-domi-rio">
      <p className={styles.sobreTitulo}>Mais da Domi-Rio</p><h2 id="outros-guias-domi-rio">Guias e novidades da loja</h2>
      <ul className={styles.listaGuias}>{existentes.map(p => <li key={p.slug}>
        <Link href={`/blog/${p.slug}`}><div><h3>{p.titulo}</h3><p>{p.resumo}</p><small>{dataLegivel(p.publicadoEm)}</small></div><ArrowUpRight size={20} aria-hidden="true" /></Link>
      </li>)}</ul>
    </section>}
    <aside className={styles.chamada}><div><p className={styles.sobreTitulo}>Próximo passo</p><h2>Da pesquisa à conversa com a equipe.</h2><p>Consulte o catálogo ou leve suas dúvidas para o atendimento da Domi-Rio.</p></div><div><Link href="/produtos">Consultar catálogo <ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/contato">Falar com a equipe</Link></div></aside>
  </div>;
}
