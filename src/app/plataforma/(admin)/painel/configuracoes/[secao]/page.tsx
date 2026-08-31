import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PainelLoja, { type SecaoPainel } from "@/components/painel/PainelLoja";
import { dadosDoPainel } from "@/lib/painel-dados";

/** Endereço legível para o lojista, seção interna para o componente. */
const SECAO: Record<string, SecaoPainel> = {
  marca: "Marca",
  entrega: "Entrega",
  recebimento: "Recebimento",
  assinatura: "Assinatura",
  conta: "Conta",
};

export const metadata: Metadata = { title: "Configurações | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params;
  const alvo = SECAO[secao];
  if (!alvo) notFound();
  return <PainelLoja secao={alvo} {...(await dadosDoPainel())} />;
}
