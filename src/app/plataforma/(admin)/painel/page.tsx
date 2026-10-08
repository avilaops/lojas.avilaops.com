import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import PrimeirosPassos from "@/components/painel/PrimeirosPassos";
import { dadosDoPainel } from "@/lib/painel-dados";
import { precisaDosPrimeirosPassos } from "@/lib/cadastro";
import { fimDoTeste } from "@/lib/planos";
import { lojistaAtual } from "@/lib/sessao";
import { abrirPedido, COOKIE_DO_PEDIDO } from "@/lib/mcp-oauth";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  // Conta recém-criada: a visão geral de uma loja sem nome, sem produto e sem
  // pedido não diz nada. Primeiro os três dados que a põem no ar.
  const conta = await lojistaAtual();
  // Quem veio conectar um assistente e precisou entrar antes cai aqui, porque
  // toda porta de login termina no painel. O pedido esperando no cookie leva
  // de volta à tela de autorização (docs/MCP.md).
  if (conta && abrirPedido((await cookies()).get(COOKIE_DO_PEDIDO)?.value)) redirect("/autorizar");
  if (conta && precisaDosPrimeirosPassos(conta)) {
    return (
      <>
        <CabecalhoSecao titulo="Bem-vindo" descricao={conta.loginEmail ?? ""} />
        <PrimeirosPassos planoInicial={conta.plano} testeAte={fimDoTeste(conta).toISOString()} />
      </>
    );
  }
  const [{ nova }, dados] = await Promise.all([searchParams, dadosDoPainel("Visão geral")]);
  return (
    <>
      {/* A contagem vem do banco, nao da fatia de 500 carregada: a tela dizia
          "500 produtos ativos" numa loja com 5.591. */}
      <CabecalhoSecao titulo={dados.loja.nome} descricao={`${dados.contagens.ativos.toLocaleString("pt-BR")} produtos · ${dados.contagens.pedidos.toLocaleString("pt-BR")} pedidos`} />
      {nova && (
        <p className="mb-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Sua loja foi criada. Siga os passos abaixo para ela começar a vender.
        </p>
      )}
      <PainelLoja secao="Visão geral" {...dados} />
    </>
  );
}
