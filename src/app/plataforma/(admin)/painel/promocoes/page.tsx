import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Promoções | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Promoções" descricao="Cupons de desconto e as regras de cada um." />
      <PainelLoja secao="Cupons" {...(await dadosDoPainel("Cupons"))} />
    </>
  );
}
