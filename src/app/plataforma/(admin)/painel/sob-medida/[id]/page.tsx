import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import FichaTecnicaSobMedida from "@/components/painel/FichaTecnicaSobMedida";
import { buscarProjetoSobMedidaNoPainel } from "@/lib/painel-sob-medida";
import { recursoAtivo } from "@/lib/recursos";
import { sessaoDoPainel } from "@/lib/sessao";

export const metadata: Metadata = { title: "Ficha sob medida | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProjetoSobMedidaPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, sessao] = await Promise.all([params, sessaoDoPainel()]);
  if (!sessao) redirect("/entrar");
  if (!recursoAtivo(sessao.tenant, "configurador_sob_medida")) notFound();
  const projeto = await buscarProjetoSobMedidaNoPainel(sessao.tenant.id, id);
  if (!projeto) notFound();

  return (
    <>
      <div className="ficha-sob-medida-nao-imprimir">
        <CabecalhoSecao titulo={`Ficha ${projeto.referencia}`} descricao="Prévia e especificação congeladas no recebimento da solicitação." acao={{ rotulo: "Voltar aos projetos", href: "/painel/sob-medida" }} />
      </div>
      <FichaTecnicaSobMedida projeto={projeto} />
    </>
  );
}
