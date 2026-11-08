import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirTenant } from "@/lib/tenant";
import { listarEditorialPk } from "@/lib/pk-editorial";
import { ListaEditorialPk } from "@/components/pk/ConteudoEditorial";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await exigirTenant();
  if (t.slug !== "pkvedacoes") notFound();
  return { title: "Guias de seleção de vedações | PK Vedações", description: "Medidas, perfis e dados de operação para identificar a peça e preparar a reposição.", alternates: { canonical: "/guias" } };
}
export default async function Pagina() {
  const t = await exigirTenant();
  if (t.slug !== "pkvedacoes") notFound();
  return <ListaEditorialPk itens={listarEditorialPk(t.slug, "guias")} titulo="Guias de seleção de vedações" resumo="Medidas, perfis e dados de operação para identificar a peça e preparar a reposição." />;
}

