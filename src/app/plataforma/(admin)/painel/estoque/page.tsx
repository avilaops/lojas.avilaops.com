import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Inventário | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Inventário" descricao="Quantidade por produto e aviso de estoque baixo." />
      <PainelLoja secao="Inventário" {...(await dadosDoPainel())} />
    </>
  );
}
