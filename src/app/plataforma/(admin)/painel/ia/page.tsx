import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "IA e API | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="IA e API" descricao="Ligue a loja a um assistente de IA ou integre seus sistemas pela API para desenvolvedores." />
      <PainelLoja secao="IA" {...(await dadosDoPainel("IA"))} />
    </>
  );
}
