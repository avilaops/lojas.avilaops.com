import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import FilaPix from "@/components/painel/FilaPix";
import { listarPixAConferir, pixManualLigado } from "@/lib/pix-manual";
import { lojistaAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Pix a conferir | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");
  if (!pixManualLigado(loja)) {
    return <CabecalhoSecao titulo="Pix a conferir" descricao="Este recurso não está ligado para esta loja." />;
  }
  const itens = await listarPixAConferir(loja.id);
  return (
    <>
      <CabecalhoSecao
        titulo="Pix a conferir"
        descricao="Quem avisou que pagou. Confira o valor na conta antes de liberar o pedido."
      />
      <FilaPix itens={itens} />
    </>
  );
}
