import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { acharPost, postsPublicados, tituloDoRelacionado } from "@/lib/blog";

export const dynamic = "force-dynamic";

const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = acharPost(slug);
  if (!post) return { title: "Texto não encontrado", robots: { index: false } };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://lojas.avilaops.com/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.publicadoEm },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = acharPost(slug);
  if (!post) notFound();

  // Texto com data futura não existe ainda: `acharPost` já filtra, então cair
  // aqui com um slug que existe no arquivo significa que ainda não é o dia.
  const outros = postsPublicados().filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="pl-container pl-post">
      <Link href="/blog" className="pl-post-voltar"><ArrowLeft size={15} /> Blog</Link>

      <article>
        <header>
          <time dateTime={post.publicadoEm}>{dia(post.publicadoEm)}</time>
          <h1>{post.title}</h1>
          <p className="pl-post-resposta">{post.answer}</p>
        </header>

        {post.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
            {s.checklist && (
              <ul className="pl-post-lista">
                {s.checklist.map((item) => (
                  <li key={item}><Check size={15} aria-hidden="true" /> {item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <section className="pl-blog-cta">
        <div>
          <h2>Isso tudo já vem pronto</h2>
          <p>Carrinho, frete por CEP, Pix na sua conta e pedido registrado. Sua loja responde no mesmo dia.</p>
        </div>
        <Link href="/criar" className="pl-header-cta">Criar minha loja <ArrowRight size={14} /></Link>
      </section>

      {post.related.length > 0 && (
        <nav className="pl-post-relacionados" aria-label="Leia também">
          <strong>Leia também</strong>
          <div>
            {post.related.map((alvo) => {
              const titulo = tituloDoRelacionado(alvo);
              // Caminho da plataforma (/criar, /ajuda) passa direto; slug vira link do blog.
              return (
                <Link key={alvo} href={titulo ? `/blog/${alvo}` : alvo}>
                  {titulo ?? (alvo.replace("/", "").replace("#", "").replaceAll("-", " ") || "Página inicial")}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {outros.length > 0 && (
        <nav className="pl-post-relacionados" aria-label="Textos recentes">
          <strong>Recentes</strong>
          <div>
            {outros.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`}>{p.title}</Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
