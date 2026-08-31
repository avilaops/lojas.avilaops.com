import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Buscadores | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Buscadores" descricao="Como Google e Bing enxergam a loja." />
      <PainelLoja secao="Buscadores" {...(await dadosDoPainel())} />
    </>
  );
}
