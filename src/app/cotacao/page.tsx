import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { tenantAtual, urlDaLoja } from "@/lib/tenant";
import { identidadePublica } from "@/lib/identidade-publica";
import { INCLUIR_OFERTA, ofertaDaVariante, pertenceAGrade } from "@/lib/catalogo-oferta";
import { type OfertaCotacaoDomiRio } from "@/lib/domirio-cotacao";
import CotacaoLista from "@/components/domirio/CotacaoLista";
import Conteudo from "@/content/domirio/cotacao.mdx";

export const metadata: Metadata = { title: "Cotação para empresas e revendedores", description: "Reúna produtos, apresentações e quantidades e solicite uma cotação à Domi-Rio Distribuidora.", alternates: { canonical: "/cotacao" } };
export const dynamic = "force-dynamic";

export default async function Cotacao({ searchParams }: { searchParams: Promise<{ produto?: string; variante?: string }> }) {
  const t = await tenantAtual();
  if (!t || t.slug !== "domi-rio" || t.status !== "ATIVA") notFound();
  const params = await searchParams;
  const produtos = await prisma.produto.findMany({ where: { tenantId: t.id, ativo: true }, select: { id: true, nome: true, slug: true, atributos: true, opcoes: true, variantes: { where: { tenantId: t.id, ativo: true }, include: INCLUIR_OFERTA } }, orderBy: { nome: "asc" } });
  const ofertas: OfertaCotacaoDomiRio[] = produtos.flatMap(p => p.variantes.filter(v => !p.opcoes.length ? v.padrao : pertenceAGrade(p.opcoes, v)).map(v => {
    const o = ofertaDaVariante(v);
    const a = p.atributos as Record<string, unknown> | null;
    return { id: `${p.id}:${v.id}`, produtoId: p.id, nome: p.nome, slug: p.slug, sku: v.sku, padrao: v.padrao, varianteId: v.id,
      apresentacao: p.opcoes.length ? v.nome : typeof a?.apresentacaoComercial === "string" ? a.apresentacaoComercial : undefined,
      estoque: o.estoque, disponivel: o.compravel };
  }));
  const inicial = ofertas.find(o => o.slug === params.produto && (!params.variante || o.varianteId === params.variante))?.id;
  return <main className="container-loja py-8 sm:py-12"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Atendimento Domi-Rio</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Cote vários produtos de uma vez.</h1><div className="prosa mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground"><Conteudo /></div><CotacaoLista ofertas={ofertas} baseUrl={urlDaLoja(t)} whatsapp={identidadePublica(t).whatsapp?.numero ?? null} inicial={inicial} /></main>;
}
