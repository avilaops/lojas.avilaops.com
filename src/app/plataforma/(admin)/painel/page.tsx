import type { Metadata } from "next";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  const [{ nova }, dados] = await Promise.all([searchParams, dadosDoPainel("Visão geral")]);
  return (
    <>
      {/* A contagem vem do banco, nao da fatia de 500 carregada: a tela dizia
          "500 produtos ativos" numa loja com 5.591. */}
      <CabecalhoSecao titulo={dados.loja.nome} descricao={`${dados.contagens.ativos.toLocaleString("pt-BR")} produtos · ${dados.contagens.pedidos.toLocaleString("pt-BR")} pedidos`} />
      {nova && (
        <p className="mb-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Sua loja está no ar. Agora envie logo, imagem principal e as fotos reais do catálogo para concluir a presença visual.
        </p>
      )}
      <PainelLoja secao="Visão geral" {...dados} />
    </>
  );
}
