import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirTenant } from "@/lib/tenant";
import { listarEditorialPk } from "@/lib/pk-editorial";
import { ListaEditorialPk } from "@/components/pk/ConteudoEditorial";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await exigirTenant();
  if (t.slug !== "pkvedacoes") notFound();
  return { title: "Aplicações de vedações por segmento | PK Vedações", description: "Casos de uso de cilindros, sintomas de falha e informações necessárias para avaliar cada aplicação.", alternates: { canonical: "/aplicacoes" } };
}
export default async function Pagina() {
  const t = await exigirTenant();
  if (t.slug !== "pkvedacoes") notFound();
  return <ListaEditorialPk itens={listarEditorialPk(t.slug, "aplicacoes")} titulo="Aplicações de vedações por segmento" resumo="Encontre o contexto do seu equipamento: produzir, cultivar, construir, movimentar ou sustentar a infraestrutura." porFinalidade />;
}

