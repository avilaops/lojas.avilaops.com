import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja } from "@/lib/tenant";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import ProdutoDetalhe from "@/components/painel/ProdutoDetalhe";

export const metadata: Metadata = { title: "Produto | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, loja] = await Promise.all([params, lojistaAtual()]);
  if (!loja) redirect("/entrar");

  // O tenant entra no `where`: produto de outra loja não existe daqui.
  const produto = await prisma.produto.findFirst({
    where: { id, tenantId: loja.id },
    select: { id: true, nome: true, slug: true, ativo: true, sku: true, opcoes: true },
  });
  if (!produto) notFound();

  return (
    <>
      <CabecalhoSecao
        titulo={produto.nome}
        descricao={[produto.sku ? `SKU ${produto.sku}` : null, produto.ativo ? "no ar" : "inativo"].filter(Boolean).join(" · ")}
      />
      <ProdutoDetalhe
        id={produto.id}
        nome={produto.nome}
        temVariacoes={produto.opcoes.length > 0}
        urlNaLoja={produto.ativo ? `${urlDaLoja(loja)}/produtos/${produto.slug}` : null}
      />
    </>
  );
}
