import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tenantAtual } from "@/lib/tenant";
import { identidadePublica } from "@/lib/identidade-publica";
import CotacaoLote from "@/components/pk/CotacaoLote";

export const metadata: Metadata = { title: "Cotação em lote", description: "Consulte códigos e quantidades no catálogo da PK Vedações e leve sua lista ao atendimento técnico.", alternates: { canonical: "/cotacao-lote" } };

export default async function PaginaCotacaoLote() {
  const tenant = await tenantAtual();
  if (!tenant || tenant.slug !== "pkvedacoes" || tenant.status !== "ATIVA") notFound();
  return <main className="container-loja py-10"><h1 className="text-3xl font-bold">Cotação em lote</h1><p className="mt-3 max-w-2xl text-muted-foreground">Confira sua lista de manutenção ou reposição de uma vez. Resolva os códigos, revise as pendências e converse com a equipe para confirmar a aplicação.</p><CotacaoLote whatsappUrl={identidadePublica(tenant).whatsapp?.url ?? null} /></main>;
}
