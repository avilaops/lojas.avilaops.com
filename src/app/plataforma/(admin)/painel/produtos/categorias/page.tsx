import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Categorias | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Categorias" descricao="As seções que organizam a vitrine e o SEO de cada uma." />
      <PainelLoja secao="Categorias" {...(await dadosDoPainel("Categorias"))} />
    </>
  );
}
