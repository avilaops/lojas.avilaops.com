import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Avaliações | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Avaliações" descricao="O que os compradores escreveram, e o que vai ao ar." />
      <PainelLoja secao="Avaliações" {...(await dadosDoPainel())} />
    </>
  );
}
