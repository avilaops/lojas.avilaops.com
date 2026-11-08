import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirTenant, urlDaLoja } from "@/lib/tenant";
import { dataLegivel, emParagrafos, minutosDeLeitura } from "@/lib/publicacoes";
import { publicacaoPorSlug } from "@/lib/publicacoes-consulta";
import { artigoDomiRio } from "@/lib/artigos-domirio";
import ArtigoDomiRio from "@/components/domirio/ArtigoDomiRio";

export const dynamic = "force-dynamic";

const linhasDosGuiasDomiRio: Readonly<Record<string, string>> = {
  "linha-termitox-40-400-spray-duo": "controle-de-pragas",
  "pirazol-top-scorpfim-como-pesquisar": "controle-de-pragas",
  "checklist-compra-inseticida-profissional": "controle-de-pragas",
  "roetox-graos-pellet-soft-bait": "controle-de-roedores",
  "sanepec-e-hora-2-controle-de-odores": "controle-de-odores",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, exigirTenant()]);
  const artigo = artigoDomiRio(t.slug, slug);
  if (artigo) {
    const base = urlDaLoja(t);
    const capa = new URL(artigo.cover, base).href;
    return {
      title: artigo.title,
      description: artigo.description,
      alternates: { canonical: `${base}/blog/${artigo.slug}` },
      openGraph: { type: "article", title: artigo.title, description: artigo.description, images: [{ url: capa, alt: artigo.coverAlt }] },
      twitter: { card: "summary_large_image", title: artigo.title, description: artigo.description, images: [capa] },
    };
  }
  const post = await publicacaoPorSlug(t.id, slug);
  if (!post) return { title: "Publicação não encontrada", robots: { index: false } };
  return {
    title: post.seoTitle ?? post.titulo,
    description: post.seoDescription ?? post.resumo ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.titulo,
      description: post.seoDescription ?? post.resumo ?? undefined,
      publishedTime: post.publicadoEm?.toISOString(),
      ...(post.capaUrl ? { images: [post.capaUrl] } : {}),
    },
  };
}

export default async function Publicacao({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t] = await Promise.all([params, exigirTenant()]);
  const artigo = artigoDomiRio(t.slug, slug);
  if (artigo) return <ArtigoDomiRio artigo={artigo} baseUrl={urlDaLoja(t)} />;
  // `publicacaoPorSlug` já exige estado publicada e data passada: rascunho e
  // post agendado devolvem 404 também por URL direta, não só na listagem.
  const post = await publicacaoPorSlug(t.id, slug);
  if (!post) notFound();

  const paragrafos = emParagrafos(post.corpo);
  const publicadoEm = post.publicadoEm!;
  const linha = linhasDosGuiasDomiRio[post.slug];

  return (
    <div className="container-loja max-w-2xl py-10">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
        <ArrowLeft size={15} aria-hidden="true" /> Blog
      </Link>

      <article className="mt-4">
        <h1 className="text-2xl font-bold leading-tight">{post.titulo}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          <time dateTime={publicadoEm.toISOString()}>{dataLegivel(publicadoEm)}</time>
          {post.autor && ` · ${post.autor}`}
          {` · ${minutosDeLeitura(post.corpo)} min de leitura`}
        </p>

        {post.capaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.capaUrl} alt="" className="mt-5 w-full rounded-xl border border-border object-cover" />
        )}

        <div className="prosa mt-6 text-[15px] leading-relaxed">
          {paragrafos.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
        {t.slug === "domi-rio" && (
          <aside className="mt-8 rounded-xl border border-border bg-muted p-5" aria-label="Continue na Domi-Rio">
            <h2 className="font-semibold">Documentação e atendimento</h2>
            <ul className="mt-3 grid gap-3 text-sm">
              {post.slug === "cypertryne-35-100-1-l-diferencas" && <>
                <li><Link className="text-primary underline" href="/produtos/cypertryne-100">Comparar volumes do Cypertryne</Link></li>
                <li><a className="text-primary underline" href="https://www.isorgan.com.br/fds/cypertryne.pdf">Consultar a FDS oficial da Isorgan (PDF)</a></li>
              </>}
              {linha && <li><Link className="text-primary underline" href={`/categoria/${linha}`}>Ver produtos desta linha</Link></li>}
              <li><a className="text-primary underline" href="https://www.gov.br/anvisa/pt-br/setorregulado/regularizacao/saneantes/classificacao-de-saneantes">Consultar a classificação de saneantes na Anvisa</a></li>
              <li><Link className="text-primary underline" href="/contato">Falar com o comercial da Domi-Rio</Link></li>
            </ul>
          </aside>
        )}
      </article>

      {/* Article em JSON-LD: é o que faz o texto aparecer como artigo na busca,
          e não como mais uma página da loja. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.titulo,
            datePublished: publicadoEm.toISOString(),
            dateModified: post.atualizadoEm.toISOString(),
            ...(post.capaUrl ? { image: post.capaUrl } : {}),
            author: { "@type": post.autor ? "Person" : "Organization", name: post.autor ?? t.nome },
            publisher: { "@type": "Organization", name: t.nome },
            mainEntityOfPage: `${urlDaLoja(t)}/blog/${post.slug}`,
          }),
        }}
      />
    </div>
  );
}
