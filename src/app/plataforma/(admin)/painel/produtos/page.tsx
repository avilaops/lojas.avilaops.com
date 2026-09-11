import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Produtos | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Produtos" descricao="Catálogo da loja: cadastro, planilha e edição." />
      <PainelLoja secao="Produtos" {...(await dadosDoPainel("Produtos"))} />
    </>
  );
}
