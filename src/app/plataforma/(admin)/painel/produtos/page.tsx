import type { Metadata } from "next";
import Link from "next/link";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Produtos | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Produtos" descricao="Catálogo da loja: cadastro, planilha e edição." />
      <div className="mb-4"><Link className="btn-secundario" href="/painel/produtos/etiquetas">Códigos de barras e etiquetas</Link></div>
      <PainelLoja secao="Produtos" {...(await dadosDoPainel("Produtos"))} />
    </>
  );
}
