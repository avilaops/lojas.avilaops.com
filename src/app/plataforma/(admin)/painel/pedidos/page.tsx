import type { Metadata } from "next";
import { Suspense } from "react";
import PainelLoja from "@/components/painel/PainelLoja";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { dadosDoPainel } from "@/lib/painel-dados";

export const metadata: Metadata = { title: "Pedidos | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  return (
    <>
      <CabecalhoSecao titulo="Pedidos" descricao="Quem comprou, o que falta separar e o que já saiu." />
      {/* A lista lê a URL no cliente (useSearchParams); sem Suspense o Next
          derruba a rota inteira para renderização dinâmica no navegador. */}
      <Suspense fallback={null}>
        <PainelLoja secao="Pedidos" {...(await dadosDoPainel("Pedidos"))} />
      </Suspense>
    </>
  );
}
