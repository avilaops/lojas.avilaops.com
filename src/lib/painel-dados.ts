import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja, temaDo, identidadeDa } from "@/lib/tenant";
import { NOME_PLANO, PRECO_PLANO } from "@/lib/assinatura";
import { resumoDeVendas } from "@/lib/relatorio";
import { diagnosticoDoFeed } from "@/lib/catalogo";
import { filaDeEspera } from "@/lib/estoque-avisos";
import { postagemAAcertar } from "@/lib/postagem";

/**
 * Os dados que o painel do lojista mostra.
 *
 * Isto era o corpo de uma página só, com treze abas dentro. Agora cada seção é
 * uma rota, e todas passam por aqui: o carregamento continua num lugar só,
 * enquanto o endereço passa a dizer onde o lojista está.
 *
 * Ainda é uma carga larga (catálogo, pedidos, avaliações, faturas) para
 * qualquer seção. É de propósito por enquanto: primeiro a navegação, depois o
 * corte por rota. Vale medir antes de cortar, porque a loja típica tem
 * dezenas de produtos, não milhares.
 */
export async function dadosDoPainel() {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");

  const [produtos, semEmbalagemTotal, ativosTotal, pedidos, faturas, cupons, categorias, avaliacoes, vendas, catalogo, espera, postagem] = await Promise.all([
    prisma.produto.findMany({ where: { tenantId: loja.id }, include: { categoria: true, _count: { select: { variantes: { where: { ativo: true } } } } }, orderBy: [{ ativo: "desc" }, { nome: "asc" }], take: 500 }),
    // Contagens do catálogo inteiro, e não da fatia de 500 carregada acima.
    //
    // O aviso de embalagem dizia "e mais 488" numa loja com 5.591 produtos sem
    // medida: ele contava dentro da fatia. Número errado numa tela onde o
    // lojista decide o que arrumar primeiro é pior que número nenhum.
    prisma.produto.count({ where: { tenantId: loja.id, ativo: true, OR: [{ pesoKg: null }, { alturaCm: null }, { larguraCm: null }, { comprimentoCm: null }] } }),
    prisma.produto.count({ where: { tenantId: loja.id, ativo: true } }),
    prisma.pedido.findMany({ where: { tenantId: loja.id }, include: { itens: true, postagem: true }, orderBy: { criadoEm: "desc" }, take: 200 }),
    prisma.fatura.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" }, take: 24 }),
    prisma.cupom.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" } }),
    prisma.categoria.findMany({ where: { tenantId: loja.id }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { produtos: true } } } }),
    prisma.avaliacao.findMany({ where: { tenantId: loja.id }, orderBy: { criadoEm: "desc" }, take: 200, include: { produto: { select: { nome: true } } } }),
    resumoDeVendas(loja.id),
    diagnosticoDoFeed(loja.id),
    filaDeEspera(loja.id),
    postagemAAcertar(loja.id),
  ]);

  return {
    /** Contagens do catálogo inteiro, para a tela não afirmar número de uma fatia. */
    contagens: { semEmbalagem: semEmbalagemTotal, ativos: ativosTotal },
    loja: {
      slug: loja.slug,
      nome: loja.nome,
      url: urlDaLoja(loja),
      status: loja.status,
      plano: loja.plano,
      tema: temaDo(loja),
      identidade: identidadeDa(loja),
      segmento: loja.segmento,
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
      // Só o fato de existir credencial; o token cifrado nunca sai daqui.
      mpConfigurado: Boolean(loja.mpAccessTokenEnc),
      emailRemetente: loja.emailRemetente,
      provisionamento: (loja.provisionamento as Record<string, string>) ?? {},
      pixels: { gtmId: loja.gtmId, metaPixelId: loja.metaPixelId, ga4Id: loja.ga4Id, googleAdsId: loja.googleAdsId, googleAdsRotuloCompra: loja.googleAdsRotuloCompra, tiktokPixelId: loja.tiktokPixelId },
      freteGratisAcima: loja.freteGratisAcima,
      retiradaNaLoja: loja.retiradaNaLoja,
      despachoDiasUteis: loja.despachoDiasUteis,
      estoqueBaixoEm: loja.estoqueBaixoEm,
      tabelaFrete: (loja.tabelaFrete as Array<{ ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }>) ?? [],
      assinatura: {
        status: loja.assinaturaStatus,
        isenta: loja.cobrancaIsenta,
        precoCentavos: PRECO_PLANO[loja.plano],
        planoNome: NOME_PLANO[loja.plano],
        ultimoPagamentoEm: loja.ultimoPagamentoEm?.toISOString() ?? null,
        setupPagoEm: loja.setupPagoEm?.toISOString() ?? null,
        criadoEm: loja.criadoEm.toISOString(),
        faturas: faturas.map((f) => ({ id: f.id, centavos: f.centavos, status: f.status, pagaEm: f.pagaEm?.toISOString() ?? null, criadoEm: f.criadoEm.toISOString() })),
      },
    },
    produtos: produtos.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, precoCentavos: p.precoCentavos, ativo: p.ativo, destaque: p.destaque, categoria: p.categoria?.nome ?? null, imagem: p.imagens[0] ?? null, disponibilidade: p.disponibilidade, estoque: p.estoque, opcoes: p.opcoes, variantes: p._count.variantes, temEmbalagem: p.alturaCm != null && p.larguraCm != null && p.comprimentoCm != null })),
    categorias: categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      slug: c.slug,
      descricao: c.descricao,
      imagemUrl: c.imagemUrl,
      ordem: c.ordem,
      produtos: c._count.produtos,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      seoKeywords: c.seoKeywords,
      seoPendente: c.seoPendente,
      seoOrigem: c.seoOrigem,
      seoModelo: c.seoModelo,
      seoAtualizadoEm: c.seoAtualizadoEm?.toISOString() ?? null,
      seoProcessandoEm: c.seoProcessandoEm?.toISOString() ?? null,
      seoErro: c.seoErro,
    })),
    vendas,
    catalogo,
    espera,
    postagem: { etiquetas: postagem.etiquetas, custoCentavos: postagem.custoCentavos, limiteCentavos: loja.limitePostagemCentavos },
    avaliacoes: avaliacoes.map((a) => ({ id: a.id, produtoNome: a.produto.nome, nome: a.nome, nota: a.nota, texto: a.texto, aprovada: a.aprovada, criadoEm: a.criadoEm.toISOString() })),
    cupons: cupons.map((c) => ({ id: c.id, codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimoCentavos: c.minimoCentavos, usosMax: c.usosMax, usos: c.usos, validoAte: c.validoAte?.toISOString() ?? null, ativo: c.ativo })),
    pedidos: pedidos.map((p) => ({ id: p.id, numero: p.numero, referencia: p.referencia, status: p.status, clienteNome: p.clienteNome, clienteEmail: p.clienteEmail, clienteTelefone: p.clienteTelefone, clienteDocumento: p.clienteDocumento, totalCentavos: p.totalCentavos, subtotalCentavos: p.subtotalCentavos, freteCentavos: p.freteCentavos, descontoCentavos: p.descontoCentavos, cupomCodigo: p.cupomCodigo, meioPagamento: p.meioPagamento, freteNome: p.freteNome, rastreio: p.rastreio, etiqueta: p.postagem ? { status: p.postagem.status, codigoObjeto: p.postagem.codigoObjeto, pdf: p.postagem.pdfEtiqueta, custoCentavos: p.postagem.custoCentavos } : null, entrega: (p.entrega as { logradouro: string; numero: string; complemento?: string | null; bairro: string; cidade: string; uf: string; cep: string } | null) ?? null, criadoEm: p.criadoEm.toISOString(), itens: p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, sku: i.sku, precoUnitarioCentavos: i.precoUnitarioCentavos })) })),
  };
}
