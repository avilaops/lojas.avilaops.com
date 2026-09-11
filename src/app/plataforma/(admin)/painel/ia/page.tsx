import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "IA | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="IA" descricao="Ligue a loja a um assistente de IA para cuidar do catálogo conversando." />
      <PainelLoja secao="IA" {...(await dadosDoPainel("IA"))} />
    </>
  );
}
