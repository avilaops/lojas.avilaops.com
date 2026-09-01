import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { postsPublicados } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog: como vender pela internet sem se perder no caminho",
  description:
    "Textos curtos sobre loja virtual, frete, Pix, estoque e pedido, na linguagem de quem vende. Um por dia, com exemplo brasileiro e sem promessa fácil.",
  alternates: { canonical: "https://lojas.avilaops.com/blog" },
};

export const dynamic = "force-dynamic";

const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

export default function BlogPage() {
  const posts = postsPublicados();
  const [primeiro, ...resto] = posts;

  return (
    <div className="pl-container pl-blog">
      <header className="pl-blog-topo">
        <span>Blog</span>
        <h1>Vender pela internet, explicado por quem opera</h1>
        <p>
          Um texto por dia sobre o que decide a venda: frete, prazo, pagamento, estoque e o que a lei exige de
          quem vende online. Sem promessa de enriquecer rápido e sem tradução de artigo americano.
        </p>
      </header>

      {!primeiro ? (
        <p className="pl-blog-vazio">O primeiro texto entra em breve.</p>
      ) : (
        <>
          <Link href={`/blog/${primeiro.slug}`} className="pl-blog-destaque">
            <time dateTime={primeiro.publicadoEm}>{dia(primeiro.publicadoEm)}</time>
            <h2>{primeiro.title}</h2>
            <p>{primeiro.description}</p>
            <span>Ler <ArrowRight size={14} /></span>
          </Link>

          {resto.length > 0 && (
            <div className="pl-blog-grade">
              {resto.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="pl-blog-item">
                  <time dateTime={p.publicadoEm}>{dia(p.publicadoEm)}</time>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <section className="pl-blog-cta">
        <div>
          <h2>Sua loja no ar hoje</h2>
          <p>Vitrine, carrinho, frete calculado e Pix caindo direto na sua conta, sem comissão sobre a venda.</p>
        </div>
        <Link href="/criar" className="pl-header-cta">Criar minha loja <ArrowRight size={14} /></Link>
      </section>
    </div>
  );
}
