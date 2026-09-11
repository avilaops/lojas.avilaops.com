import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Anúncios | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Anúncios" descricao="Pixels de medição e o feed de produtos para as plataformas." />
      <PainelLoja secao="Anúncios" {...(await dadosDoPainel("Anúncios"))} />
    </>
  );
}
