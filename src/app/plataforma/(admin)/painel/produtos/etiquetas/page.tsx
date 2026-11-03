import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessaoDoPainel } from "@/lib/sessao";
import { permite } from "@/lib/operadores";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import EtiquetasProdutos from "@/components/painel/EtiquetasProdutos";

export const metadata: Metadata = { title: "Etiquetas | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ produtoId?: string }> }) {
  const sessao = await sessaoDoPainel();
  if (!sessao) redirect("/entrar");
  if (!permite(sessao.papel, "catalogo")) redirect("/painel");
  const { produtoId } = await searchParams;
  return <>
    <CabecalhoSecao titulo="Etiquetas de produtos" descricao="Códigos de barras, seleção em lote e impressão." />
    <EtiquetasProdutos key={produtoId ?? "todos"} produtoId={produtoId} />
  </>;
}
