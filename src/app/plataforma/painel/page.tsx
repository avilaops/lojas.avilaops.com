import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja, temaDo } from "@/lib/tenant";
import PainelLoja from "@/components/painel/PainelLoja";
import { NOME_PLANO, PRECO_PLANO } from "@/lib/assinatura";

export const metadata: Metadata = { title: "Painel — Lojas by Avila Ops", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");
  const { nova } = await searchParams;

  const [produtos, pedidos, contagem, faturas, cupons] = await Promise.all([
    prisma.produto.findMany({ where: { tenantId: loja.id }, include: { categoria: true, _count: { select: { variantes: { where: { ativo: true } } } } }, orderBy: [{ ativo: "desc" }, { nome: "asc" }], take: 500 }),
    prisma.pedido.findMany({ where: { tenantId: loja.id }, include: { itens: true }, orderBy: { criadoEm: "desc" }, take: 200 }),
    prisma.produto.count({ where: { tenantId: loja.id, ativo: true } }),
    prisma.fatura.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" }, take: 24 }),
    prisma.cupom.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" } }),
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
          assinatura: {
            status: loja.assinaturaStatus,
            precoCentavos: PRECO_PLANO[loja.plano],
            planoNome: NOME_PLANO[loja.plano],
            ultimoPagamentoEm: loja.ultimoPagamentoEm?.toISOString() ?? null,
            setupPagoEm: loja.setupPagoEm?.toISOString() ?? null,
            criadoEm: loja.criadoEm.toISOString(),
            faturas: faturas.map((f) => ({ id: f.id, centavos: f.centavos, status: f.status, pagaEm: f.pagaEm?.toISOString() ?? null, criadoEm: f.criadoEm.toISOString() })),
          },
        }}
        produtos={produtos.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, precoCentavos: p.precoCentavos, ativo: p.ativo, destaque: p.destaque, categoria: p.categoria?.nome ?? null, imagem: p.imagens[0] ?? null, disponibilidade: p.disponibilidade, estoque: p.estoque, opcoes: p.opcoes, variantes: p._count.variantes }))}
        cupons={cupons.map((c) => ({ id: c.id, codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimoCentavos: c.minimoCentavos, usosMax: c.usosMax, usos: c.usos, validoAte: c.validoAte?.toISOString() ?? null, ativo: c.ativo }))}
        pedidos={pedidos.map((p) => ({ id: p.id, numero: p.numero, referencia: p.referencia, status: p.status, clienteNome: p.clienteNome, clienteTelefone: p.clienteTelefone, totalCentavos: p.totalCentavos, meioPagamento: p.meioPagamento, freteNome: p.freteNome, rastreio: p.rastreio, criadoEm: p.criadoEm.toISOString(), itens: p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade })) }))}
      />
    </div>
  );
}
