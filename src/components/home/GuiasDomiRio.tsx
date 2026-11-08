import Link from "@/components/LinkLoja";
import { ArrowUpRight, BookOpen, MessageCircle } from "lucide-react";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { listarPublicadas } from "@/lib/publicacoes-consulta";

export default async function GuiasDomiRio({ tenantId, whatsapp }: { tenantId: string; whatsapp?: string }) {
  const guias = await listarPublicadas(tenantId, 3);
  if (!guias.length) return null;
  return (
    <section className="container-loja py-12" aria-labelledby="guias-domi-rio">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Central Domi-Rio</p>
          <h2 id="guias-domi-rio" className="mt-2 text-2xl font-bold sm:text-3xl">Guias de saneantes e controle de pragas</h2>
          <p className="mt-2 text-sm text-muted-foreground">Compare apresentações, confira o que procurar no rótulo e saiba como preparar sua cotação.</p>
        </div>
        <Link href="/blog" className="btn-secundario inline-flex min-h-11 items-center gap-2">Todos os guias <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
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
