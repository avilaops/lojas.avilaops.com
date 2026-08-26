import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja, temaDo, identidadeDa } from "@/lib/tenant";
import PainelLoja from "@/components/painel/PainelLoja";
import { NOME_PLANO, PRECO_PLANO } from "@/lib/assinatura";
import { resumoDeVendas } from "@/lib/relatorio";
import { diagnosticoDoFeed } from "@/lib/catalogo";
import { filaDeEspera } from "@/lib/estoque-avisos";

export const metadata: Metadata = { title: "Painel — Lojas by Avila Ops", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");
  const { nova } = await searchParams;

  const [produtos, pedidos, contagem, faturas, cupons, categorias, avaliacoes, vendas, catalogo, espera] = await Promise.all([
    prisma.produto.findMany({ where: { tenantId: loja.id }, include: { categoria: true, _count: { select: { variantes: { where: { ativo: true } } } } }, orderBy: [{ ativo: "desc" }, { nome: "asc" }], take: 500 }),
    prisma.pedido.findMany({ where: { tenantId: loja.id }, include: { itens: true }, orderBy: { criadoEm: "desc" }, take: 200 }),
    prisma.produto.count({ where: { tenantId: loja.id, ativo: true } }),
    prisma.fatura.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" }, take: 24 }),
    prisma.cupom.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" } }),
    prisma.categoria.findMany({ where: { tenantId: loja.id }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { produtos: true } } } }),
    prisma.avaliacao.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" }, take: 200, include: { produto: { select: { nome: true } } } }),
    resumoDeVendas(loja.id),
    diagnosticoDoFeed(loja.id),
    filaDeEspera(loja.id),
  ]);

  return (
    <div className="container-loja pl-workspace max-w-6xl py-10">
      <header className="pl-panel-heading mb-8">
        <div><span>Seu negócio digital</span><h1>{loja.nome}</h1></div>
        <p>
          <a href={urlDaLoja(loja)} target="_blank" rel="noopener" className="underline">{urlDaLoja(loja).replace(/^https?:\/\//, "")}</a>
          {" · "}{contagem} produtos ativos · {pedidos.length} pedidos
        </p>
        {nova && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Sua loja está no ar. Agora envie logo, imagem principal e as fotos reais do catálogo para concluir a presença visual.</p>}
      </header>
      <PainelLoja
        loja={{
          slug: loja.slug,
          nome: loja.nome,
          url: urlDaLoja(loja),
          status: loja.status,
          plano: loja.plano,
          tema: temaDo(loja),
          identidade: identidadeDa(loja),
          slogan: loja.slogan,
          logoUrl: loja.logoUrl,
          whatsapp: loja.whatsapp,
          emailContato: loja.emailContato,
          avisoTopo: loja.avisoTopo,
          razaoSocial: loja.razaoSocial,
          cnpj: loja.cnpj,
          dominioPrincipal: loja.dominioPrincipal,
          bannerUrl: loja.bannerUrl,
          mpPublicKey: loja.mpPublicKey,
          emailRemetente: loja.emailRemetente,
          provisionamento: (loja.provisionamento as Record<string, string>) ?? {},
          pixels: { gtmId: loja.gtmId, metaPixelId: loja.metaPixelId, ga4Id: loja.ga4Id, googleAdsId: loja.googleAdsId, googleAdsRotuloCompra: loja.googleAdsRotuloCompra, tiktokPixelId: loja.tiktokPixelId },
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
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, slug: c.slug, descricao: c.descricao, imagemUrl: c.imagemUrl, ordem: c.ordem, produtos: c._count.produtos }))}
        vendas={vendas}
        catalogo={catalogo}
        espera={espera}
        avaliacoes={avaliacoes.map((a) => ({ id: a.id, produtoNome: a.produto.nome, nome: a.nome, nota: a.nota, texto: a.texto, aprovada: a.aprovada, criadoEm: a.criadoEm.toISOString() }))}
        cupons={cupons.map((c) => ({ id: c.id, codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimoCentavos: c.minimoCentavos, usosMax: c.usosMax, usos: c.usos, validoAte: c.validoAte?.toISOString() ?? null, ativo: c.ativo }))}
        pedidos={pedidos.map((p) => ({ id: p.id, numero: p.numero, referencia: p.referencia, status: p.status, clienteNome: p.clienteNome, clienteTelefone: p.clienteTelefone, totalCentavos: p.totalCentavos, meioPagamento: p.meioPagamento, freteNome: p.freteNome, rastreio: p.rastreio, criadoEm: p.criadoEm.toISOString(), itens: p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade })) }))}
      />
    </div>
  );
}
