import Link from "@/components/LinkLoja";
import { ArrowUpRight, BookOpen, MessageCircle } from "lucide-react";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { listarPublicadas } from "@/lib/publicacoes-consulta";
import { artigosDomiRio } from "@/lib/artigos-domirio";

const linhas = [
  { slug: "controle-de-pragas", nome: "Controle de pragas" },
  { slug: "controle-de-roedores", nome: "Controle de roedores" },
  { slug: "controle-de-odores", nome: "Controle de odores" },
  { slug: "herbicidas", nome: "Herbicidas" },
];

export default async function GuiasDomiRio({ tenantId, whatsapp }: { tenantId: string; whatsapp?: string }) {
  const publicados = await listarPublicadas(tenantId, 3);
  const editoriais = artigosDomiRio("domi-rio");
  const guias = [
    ...publicados.filter(p => !editoriais.some(a => a.slug === p.slug)),
    ...[1, 6, 15].map(ordem => editoriais.find(p => p.order === ordem)!).map(p => ({ slug: p.slug, titulo: p.title, resumo: p.description })),
  ];
  if (!guias.length) return null;
  return (
    <section className="container-loja py-12" aria-labelledby="guias-domi-rio">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Central Domi-Rio</p>
          <h2 id="guias-domi-rio" className="mt-2 text-2xl font-bold sm:text-3xl">Guias e orientações Domi-Rio</h2>
          <p className="mt-2 text-sm text-muted-foreground">Orientações sobre controle de pragas, defensivos e cuidados na aplicação para apoiar sua pesquisa e preparar a cotação.</p>
        </div>
        <Link href="/blog" className="btn-secundario inline-flex min-h-11 items-center gap-2">Todos os guias <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <nav aria-label="Linhas do catálogo Domi-Rio" className="mt-5 flex flex-wrap gap-2">
        {linhas.map(linha => (
          <Link key={linha.slug} href={`/categoria/${linha.slug}`} className="btn-secundario inline-flex min-h-11 items-center text-sm">
            {linha.nome}
          </Link>
        ))}
      </nav>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {guias.map(guia => (
          <li key={guia.slug} className="rounded-xl border border-border bg-card">
            <Link href={`/blog/${guia.slug}`} className="group flex h-full flex-col gap-3 p-5">
              <BookOpen size={20} className="text-primary" aria-hidden="true" />
              <h3 className="font-semibold group-hover:underline">{guia.titulo}</h3>
              <p className="text-sm text-muted-foreground">{guia.resumo}</p>
              <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-primary">Ler guia <ArrowUpRight size={15} aria-hidden="true" /></span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted p-5">
        <div>
          <p className="font-semibold">Comprando para sua empresa?</p>
          <p className="mt-1 text-sm text-muted-foreground">Fale com o comercial para consultar apresentações, documentação e cotação.</p>
        </div>
        {whatsapp ? (
          <a className="btn-primario inline-flex min-h-11 items-center gap-2"
            href={linkWhatsApp(whatsapp, "Olá! Vim pela Central Domi-Rio e gostaria de cotar produtos para minha empresa.")}
            target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> Falar com o comercial
          </a>
        ) : <Link href="/contato" className="btn-secundario inline-flex min-h-11 items-center">Ver canais de atendimento</Link>}
      </div>
    </section>
  );
}
