import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, BookOpen } from "lucide-react";
import { postsPublicados } from "@/lib/blog";
import "./blog.css";

export const metadata: Metadata = {
  title: "Blog: como vender pela internet sem se perder no caminho",
  description: "Guias sobre loja virtual, frete, Pix, estoque e pedidos, na linguagem de quem vende.",
  alternates: { canonical: "https://lojas.avilaops.com/blog" },
};
export const dynamic = "force-dynamic";
const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export default function BlogPage() {
  const [primeiro, ...resto] = postsPublicados();
  return <div className="pl-site-claro blog-shell">
    <div className="blog-container">
      <header className="blog-intro">
        <span><BookOpen size={15} aria-hidden="true" /> Blog do lojista</span>
        <h1>Vender online começa<br /> por entender o caminho.</h1>
        <p>Catálogo, pagamento, estoque e pedidos. Explicações práticas para cuidar da sua loja e dar o próximo passo.</p>
      </header>
      {!primeiro ? <div className="blog-vazio"><BookOpen size={28} aria-hidden="true" /><h2>Estamos preparando os primeiros artigos.</h2><p>Enquanto isso, confira o guia para começar sua loja.</p><Link href="/ajuda">Ir para a Ajuda <ArrowRight size={16} aria-hidden="true" /></Link></div> : <>
        <section aria-label="Artigo em destaque">
          <Link href={`/blog/${primeiro.slug}`} className="blog-destaque">
            <div className="blog-destaque-imagem">{primeiro.capa ? <Image src={primeiro.capa} alt="" fill sizes="(max-width: 760px) 100vw, 560px" priority /> : <BookOpen size={48} aria-hidden="true" />}</div>
            <div className="blog-destaque-texto"><span className="blog-etiqueta">Em destaque</span><time dateTime={primeiro.publicadoEm}>{dia(primeiro.publicadoEm)}</time><h2>{primeiro.title}</h2><p>{primeiro.description}</p><span className="blog-ler">Ler artigo <ArrowRight size={16} aria-hidden="true" /></span></div>
          </Link>
        </section>
        {resto.length > 0 && <section aria-labelledby="mais-artigos"><header className="blog-secao-cabecalho"><h2 id="mais-artigos">Mais para o seu dia a dia</h2><span>{resto.length} artigos</span></header>
          <div className="blog-grade">{resto.map((post) => <article key={post.slug} className="blog-cartao"><Link href={`/blog/${post.slug}`}>
            <div className="blog-cartao-imagem">{post.capa ? <Image src={post.capa} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1050px) 50vw, 360px" /> : <BookOpen size={36} aria-hidden="true" />}</div>
            <div className="blog-cartao-texto"><time dateTime={post.publicadoEm}>{dia(post.publicadoEm)}</time><h3>{post.title}</h3><p>{post.description}</p><span className="blog-ler">Ler artigo <ArrowRight size={15} aria-hidden="true" /></span></div>
          </Link></article>)}</div>
        </section>}
      </>}
      <aside className="blog-convite"><div><span>Da leitura à prática</span><h2>Um passo de cada vez, com a sua loja.</h2><p>O guia do lojista mostra onde encontrar cada recurso no painel.</p></div><Link href="/ajuda">Explorar o guia <ArrowRight size={17} aria-hidden="true" /></Link></aside>
    </div>
  </div>;
}
