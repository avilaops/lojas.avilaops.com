import Link from "next/link";
import type { ReactNode } from "react";
import type { EditorialPk, TipoEditorialPk } from "@/lib/pk-editorial";

export function ListaEditorialPk({ itens, titulo, resumo }: { itens: readonly EditorialPk[]; titulo: string; resumo: string }) {
  return <main className="container-loja py-10">
    <Link href="/" className="text-sm underline">Início da PK</Link>
    <h1 className="mt-4 text-3xl font-bold">{titulo}</h1>
    <p className="mt-3 max-w-3xl text-muted-foreground">{resumo}</p>
    <ul className="mt-8 grid gap-5 md:grid-cols-2">
      {itens.map(item => <li key={item.slug} className="rounded-xl border border-border p-6">
        <h2 className="text-xl font-semibold"><Link href={`/${item.tipo}/${item.slug}`} className="hover:underline">{item.titulo}</Link></h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.resumo}</p>
      </li>)}
    </ul>
    <nav className="mt-8 flex flex-wrap gap-5 text-sm underline" aria-label="Conteúdo e cotação PK">
      <Link href="/guias">Guias de seleção</Link><Link href="/aplicacoes">Aplicações por segmento</Link><Link href="/cotacao-lote">Preparar cotação por lote</Link>
    </nav>
  </main>;
}
export default function ConteudoEditorial({ item, baseUrl, children }: { item: EditorialPk; baseUrl: string; children: ReactNode }) {
  const grupo: Record<TipoEditorialPk, string> = { guias: "Guias", aplicacoes: "Aplicações" };
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/${item.tipo}/${item.slug}`;
  const dados = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: item.titulo, description: item.resumo, mainEntityOfPage: url, author: { "@type": "Organization", name: "PK Vedações" }, publisher: { "@type": "Organization", name: "PK Vedações" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: base },
        { "@type": "ListItem", position: 2, name: grupo[item.tipo], item: `${base}/${item.tipo}` },
        { "@type": "ListItem", position: 3, name: item.titulo, item: url },
      ] },
    ],
  };
  return <main className="container-loja max-w-3xl py-10">
    <nav className="flex flex-wrap gap-3 text-sm underline" aria-label="Navegação do artigo"><Link href="/">Início</Link><Link href={`/${item.tipo}`}>{grupo[item.tipo]}</Link></nav>
    <article className="mt-6"><h1 className="text-3xl font-bold leading-tight">{item.titulo}</h1><p className="mt-4 text-lg text-muted-foreground">{item.resumo}</p><div className="prosa mt-8 leading-relaxed">{children}</div></article>
    <aside className="mt-8 rounded-xl border border-border p-6"><h2 className="font-semibold">Da identificação à cotação</h2><p className="mt-2 text-sm">Separe medidas, perfil, condições do circuito e quantidade por posição.</p><Link href="/cotacao-lote" className="mt-3 inline-block underline">Enviar lista para cotação</Link></aside>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, "\\u003c") }} />
  </main>;
}

