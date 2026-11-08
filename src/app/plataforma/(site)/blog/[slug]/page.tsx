import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { ComponentPropsWithoutRef } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { acharPost, postsPublicados, tituloDoRelacionado } from "@/lib/blog";
import { CONTEUDOS_BLOG } from "@/lib/blog-conteudo";
import IndiceAjuda from "@/components/plataforma/IndiceAjuda";
import "../blog.css";

export const dynamic = "force-dynamic";
const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = acharPost(slug);
  if (!post) return { title: "Texto não encontrado", robots: { index: false } };
  // A URL da capa vai absoluta: WhatsApp e LinkedIn não resolvem caminho
  // relativo, e a prévia sai sem imagem mesmo com o arquivo no ar.
  const capa = post.capa ? `https://lojas.avilaops.com${post.capa}` : null;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://lojas.avilaops.com/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publicadoEm,
      ...(capa ? { images: [{ url: capa, width: 1200, height: 630, alt: post.title }] } : {}),
    },
    // Sem imagem o card grande fica com um retângulo vazio: "summary" é o
    // formato honesto para post sem capa.
    twitter: capa
      ? { card: "summary_large_image", title: post.title, description: post.description, images: [capa] }
      : { card: "summary", title: post.title, description: post.description },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = acharPost(slug);
  if (!post) notFound();
  const carregar = CONTEUDOS_BLOG[post.slug as keyof typeof CONTEUDOS_BLOG];
  if (!carregar) notFound();
  const { default: Conteudo, capitulos, leituraMinutos } = await carregar();
  const outros = postsPublicados().filter((artigo) => artigo.slug !== post.slug).slice(0, 3);
  const destinos: Record<string, string> = { "/criar": "Criar minha loja", "/ajuda": "Guia do lojista", "/#planos": "Conhecer os planos" };

  return <div className="pl-site-claro blog-shell blog-artigo">
    <div className="blog-container">
      <Link href="/blog" className="blog-voltar"><ArrowLeft size={15} aria-hidden="true" /> Voltar ao Blog</Link>
      <header className="blog-artigo-cabecalho">
        <div className="blog-artigo-meta"><span>Blog do lojista</span><time dateTime={post.publicadoEm}>{dia(post.publicadoEm)}</time><span><Clock size={14} aria-hidden="true" />{leituraMinutos} min de leitura</span></div>
        <h1>{post.title}</h1><p>{post.description}</p>
      </header>
      {post.capa && <div className="blog-artigo-capa"><Image src={post.capa} alt="" fill sizes="(max-width: 760px) 100vw, 900px" priority /></div>}
      <div className="blog-leitura-layout">
        <aside className="blog-indice"><IndiceAjuda capitulos={capitulos} rotulo="Seções do artigo" /><Link href="/ajuda" className="blog-indice-guia">Precisa de um passo a passo?<span>Conhecer o guia <ArrowRight size={14} aria-hidden="true" /></span></Link></aside>
        <article className="blog-artigo-conteudo"><Conteudo components={{ ul: (props: ComponentPropsWithoutRef<"ul">) => <ul {...props} role="list" /> }} /></article>
      </div>
      {post.related.length > 0 && <nav className="blog-proximos-passos" aria-label="Próximos passos"><strong>Continue por aqui</strong><div>{post.related.map((alvo) => {
        const titulo = tituloDoRelacionado(alvo);
        if (!titulo && !alvo.startsWith("/")) return null;
        return <Link key={alvo} href={titulo ? `/blog/${alvo}` : alvo}>{titulo ?? destinos[alvo] ?? "Conhecer a plataforma"}<ArrowRight size={14} aria-hidden="true" /></Link>;
      })}</div></nav>}
      {outros.length > 0 && <section className="blog-relacionados" aria-labelledby="outros-artigos"><h2 id="outros-artigos">Mais para a sua loja</h2><div>{outros.map((artigo) => <Link key={artigo.slug} href={`/blog/${artigo.slug}`}>{artigo.title}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>}
    </div>
  </div>;
}
