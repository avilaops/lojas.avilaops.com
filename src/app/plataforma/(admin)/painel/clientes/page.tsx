import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import { clientesDaLoja } from "@/lib/clientes";
import Clientes from "@/components/painel/Clientes";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";

export const metadata: Metadata = { title: "Clientes | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");
  const clientes = await clientesDaLoja(loja.id);
  return (
    <>
      <CabecalhoSecao titulo="Clientes" descricao="Quem já comprou, quanto gastou e como falar com a pessoa." />
      <div className="grid gap-6">
        <Clientes
          clientes={clientes.map((c) => ({
            ...c,
            primeiraCompra: c.primeiraCompra.toISOString(),
            ultimaCompra: c.ultimaCompra.toISOString(),
          }))}
        />
      </div>
    </>
  );
}
