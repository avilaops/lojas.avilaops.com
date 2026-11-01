import type { Metadata } from "next";
import Cotacoes from "@/components/b2b/Cotacoes";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { sessaoDoPainel } from "@/lib/sessao";

export const metadata: Metadata = { title: "Cotações B2B | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function Pagina({ searchParams }: { searchParams: Promise<{ cotacao?: string }> }) {
  const sessao = await sessaoDoPainel();
  if (!sessao) return null;
  return <><CabecalhoSecao titulo="Cotações B2B" descricao="Negocie condições, acompanhe aprovações e transforme cotações em pedidos." /><Cotacoes modo="painel" email={sessao.operador?.email ?? sessao.tenant.loginEmail ?? ""} inicial={(await searchParams).cotacao} /></>;
}
