import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja, temaDo } from "@/lib/tenant";
import PainelLoja from "@/components/painel/PainelLoja";

export const metadata: Metadata = { title: "Painel — Lojas by Avila Ops", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");
  const { nova } = await searchParams;

  const [produtos, pedidos, contagem] = await Promise.all([
    prisma.produto.findMany({ where: { tenantId: loja.id }, include: { categoria: true }, orderBy: [{ ativo: "desc" }, { nome: "asc" }], take: 500 }),
    prisma.pedido.findMany({ where: { tenantId: loja.id }, include: { itens: true }, orderBy: { criadoEm: "desc" }, take: 200 }),
    prisma.produto.count({ where: { tenantId: loja.id, ativo: true } }),
  ]);

  return (
    <div className="container-loja max-w-4xl py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">{loja.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <a href={urlDaLoja(loja)} target="_blank" rel="noopener" className="underline">{urlDaLoja(loja).replace(/^https?:\/\//, "")}</a>
          {" · "}{contagem} produtos ativos · {pedidos.length} pedidos
        </p>
        {nova && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm">Sua loja está no ar. Próximos passos: cadastre produtos e configure o recebimento no Mercado Pago.</p>}
      </header>
      <PainelLoja
        loja={{
          slug: loja.slug,
          nome: loja.nome,
          url: urlDaLoja(loja),
          status: loja.status,
          plano: loja.plano,
          tema: temaDo(loja),
          slogan: loja.slogan,
          logoUrl: loja.logoUrl,
          whatsapp: loja.whatsapp,
          emailContato: loja.emailContato,
          dominioPrincipal: loja.dominioPrincipal,
          mpPublicKey: loja.mpPublicKey,
          emailRemetente: loja.emailRemetente,
          provisionamento: (loja.provisionamento as Record<string, string>) ?? {},
          freteGratisAcima: loja.freteGratisAcima,
          retiradaNaLoja: loja.retiradaNaLoja,
          despachoDiasUteis: loja.despachoDiasUteis,
          tabelaFrete: (loja.tabelaFrete as Array<{ ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }>) ?? [],
        }}
        produtos={produtos.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, precoCentavos: p.precoCentavos, ativo: p.ativo, destaque: p.destaque, categoria: p.categoria?.nome ?? null, imagem: p.imagens[0] ?? null, disponibilidade: p.disponibilidade }))}
        pedidos={pedidos.map((p) => ({ id: p.id, numero: p.numero, referencia: p.referencia, status: p.status, clienteNome: p.clienteNome, clienteTelefone: p.clienteTelefone, totalCentavos: p.totalCentavos, meioPagamento: p.meioPagamento, freteNome: p.freteNome, rastreio: p.rastreio, criadoEm: p.criadoEm.toISOString(), itens: p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade })) }))}
      />
    </div>
  );
}
