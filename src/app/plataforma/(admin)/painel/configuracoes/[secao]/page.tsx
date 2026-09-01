import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PainelLoja, { type SecaoPainel } from "@/components/painel/PainelLoja";
import Dominio from "@/components/painel/Dominio";
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

  // Domínio não é uma seção do PainelLoja: é tela própria, com verificação de
  // DNS, e não precisa do catálogo nem dos pedidos para desenhar.
  if (secao === "dominio") {
    const { loja } = await dadosDoPainel();
    return <div className="grid gap-6"><Dominio loja={{ slug: loja.slug, url: loja.url, dominioPrincipal: loja.dominioPrincipal, plano: loja.plano }} /></div>;
  }

  const alvo = SECAO[secao];
  if (!alvo) notFound();
  return <PainelLoja secao={alvo} {...(await dadosDoPainel())} />;
}
