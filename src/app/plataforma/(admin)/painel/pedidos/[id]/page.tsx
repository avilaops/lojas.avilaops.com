import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import PedidoDetalhe from "@/components/painel/PedidoDetalhe";

export const metadata: Metadata = { title: "Pedido | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, loja] = await Promise.all([params, lojistaAtual()]);
  if (!loja) redirect("/entrar");

  // O tenant entra no `where`, não numa conferência depois: assim não existe
  // caminho em que o id de outra loja chega a ser lido.
  const pedido = await prisma.pedido.findFirst({
    where: { id, tenantId: loja.id },
    include: { itens: true, postagem: true },
  });
  if (!pedido) notFound();

  return (
    <>
      <CabecalhoSecao titulo={`Pedido #${pedido.numero}`} descricao={pedido.clienteNome} />
      <PedidoDetalhe
        loja={{ nome: loja.nome, razaoSocial: loja.razaoSocial, cnpj: loja.cnpj }}
        pedido={{
          id: pedido.id,
          numero: pedido.numero,
          referencia: pedido.referencia,
          status: pedido.status,
          clienteNome: pedido.clienteNome,
          clienteEmail: pedido.clienteEmail,
          clienteTelefone: pedido.clienteTelefone,
          clienteDocumento: pedido.clienteDocumento,
          totalCentavos: pedido.totalCentavos,
          subtotalCentavos: pedido.subtotalCentavos,
          freteCentavos: pedido.freteCentavos,
          descontoCentavos: pedido.descontoCentavos,
          cupomCodigo: pedido.cupomCodigo,
          meioPagamento: pedido.meioPagamento,
          freteNome: pedido.freteNome,
          rastreio: pedido.rastreio,
          etiqueta: pedido.postagem
            ? { status: pedido.postagem.status, codigoObjeto: pedido.postagem.codigoObjeto, pdf: pedido.postagem.pdfEtiqueta, custoCentavos: pedido.postagem.custoCentavos }
            : null,
          entrega: (pedido.entrega as { logradouro: string; numero: string; complemento?: string | null; bairro: string; cidade: string; uf: string; cep: string } | null) ?? null,
          criadoEm: pedido.criadoEm.toISOString(),
          itens: pedido.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, sku: i.sku, precoUnitarioCentavos: i.precoUnitarioCentavos })),
        }}
      />
    </>
  );
}
