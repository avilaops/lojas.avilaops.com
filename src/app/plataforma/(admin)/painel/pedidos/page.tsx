import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Pedidos | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Pedidos" descricao="Quem comprou, o que falta separar e o que já saiu." />
      <PainelLoja secao="Pedidos" {...(await dadosDoPainel())} />
    </>
  );
}
