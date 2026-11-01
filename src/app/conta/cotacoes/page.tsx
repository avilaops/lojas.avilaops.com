import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Cotacoes from "@/components/b2b/Cotacoes";
import { exigirTenant } from "@/lib/tenant";
import { compradorAtual } from "@/lib/conta";

export const metadata: Metadata = { title: "Minhas cotações", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function Pagina({ searchParams }: { searchParams: Promise<{ cotacao?: string }> }) {
  const tenant = await exigirTenant();
  const comprador = await compradorAtual(tenant);
  if (!comprador) redirect("/conta");
  return <div className="container-loja min-w-0 py-8"><h1 className="mb-5 text-2xl font-bold">Minhas cotações</h1><Cotacoes modo="conta" email={comprador.email} inicial={(await searchParams).cotacao} /></div>;
}
