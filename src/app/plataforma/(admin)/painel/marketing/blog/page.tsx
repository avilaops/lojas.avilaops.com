import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import Publicacoes from "@/components/painel/Publicacoes";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja } from "@/lib/tenant";

export const metadata: Metadata = { title: "Blog | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  const loja = await lojistaAtual();
  if (!loja) notFound();
  return (
    <>
      <CabecalhoSecao titulo="Blog" descricao="Textos que trazem para a loja quem ainda está pesquisando" />
      <Publicacoes urlLoja={urlDaLoja(loja)} />
    </>
  );
}
