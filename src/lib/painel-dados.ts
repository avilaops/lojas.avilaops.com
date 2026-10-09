import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja, temaDo, identidadeDa } from "@/lib/tenant";
import { NOME_PLANO } from "@/lib/assinatura";
import { mensalidadeDaLoja } from "@/lib/faixas-antigas";
import { fimDoTeste } from "@/lib/planos";
import { resumoDeVendas, type ResumoVendas } from "@/lib/relatorio";
import { diagnosticoDoFeed, type DiagnosticoFeed } from "@/lib/catalogo";
import { filaDeEspera } from "@/lib/estoque-avisos";
import { postagemAAcertar } from "@/lib/postagem";
import { aplicativoConfigurado as mercadoPagoDisponivel, conectadoPorOAuth } from "@/lib/mercado-pago-conta";
import type { SecaoPainel } from "@/components/painel/PainelLoja";

/**
 * Os dados que o painel do lojista mostra, por seção.
 *
 * Era uma carga só para todas as rotas: 500 produtos com categoria, 200
 * pedidos com itens, cupons, categorias, 200 avaliações, resumo de vendas e
 * diagnóstico do feed, em qualquer tela, inclusive em Marca e Promoções, que
 * não tocam em nada disso. Medido em 11/09/2026 contra o banco de produção:
 * 3,6 s e 974 KB serializados por rota na Vedashow, 787 ms na Brilhax.
 *
 * Agora cada seção declara o que precisa em `PRECISA`, e o resto não é
 * consultado. O que toda seção carrega é só a loja (com faturas, que a
 * Assinatura mostra e é barata): uma consulta.
 *
 * `produtos` saiu de vez: Catálogo e Inventário buscam pela API paginada, e
 * nenhuma seção lia o array. Pedidos também: a lista tem API própria com
 * filtro e página no banco (`/api/painel/pedidos`).
 */

type Precisa = { cupons?: true; categorias?: true; avaliacoes?: true; vendas?: true; catalogo?: true; postagem?: true; contagens?: true };

const PRECISA: Record<SecaoPainel, Precisa> = {
  "Visão geral": { vendas: true, contagens: true },
  "Pedidos": { postagem: true },
  "Produtos": { categorias: true, contagens: true },
  "Categorias": { categorias: true },
  "Inventário": {},
  "Cupons": { cupons: true },
  "Avaliações": { avaliacoes: true },
  "Buscadores": {},
  "Anúncios": { catalogo: true },
  "IA": {},
  "Marca": {},
  "Entrega": {},
  "Recebimento": {},
  "Assinatura": {},
  "Conta": {},
};

// O que uma seção recebe quando não pediu: o formato certo, zerado. A tela
// que não usa não desenha; a tipagem continua a mesma para todas.
const VAZIO_VENDAS: ResumoVendas = { receitaCentavos: 0, pedidos: 0, ticketMedioCentavos: 0, variacao: null, serie: [], top: [], aguardandoPagamento: 0, aSeparar: 0, carrinhosAbertos: 0 };
const VAZIO_CATALOGO: DiagnosticoFeed = { total: 0, prontos: 0, problemas: [] };

export async function dadosDoPainel(secao: SecaoPainel) {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");
  const p = PRECISA[secao];
  const id = loja.id;

  const [faturas, semEmbalagemTotal, ativosTotal, semFotoTotal, pedidosTotal, cupons, categorias, avaliacoes, vendas, catalogo, espera, postagem] = await Promise.all([
    prisma.fatura.findMany({ where: { tenantId: id }, orderBy: { criadoEm: "desc" }, take: 24 }),
    // Contagens do catálogo inteiro. O aviso de embalagem dizia "e mais 488"
    // numa loja com 5.591 produtos sem medida, porque contava dentro de uma
    // fatia. Número errado numa tela onde o lojista decide o que arrumar
    // primeiro é pior que número nenhum.
    p.contagens ? prisma.produto.count({ where: { tenantId: id, ativo: true, OR: [{ pesoKg: null }, { alturaCm: null }, { larguraCm: null }, { comprimentoCm: null }] } }) : 0,
    p.contagens ? prisma.produto.count({ where: { tenantId: id, ativo: true } }) : 0,
    p.contagens ? prisma.produto.count({ where: { tenantId: id, ativo: true, imagens: { isEmpty: true } } }) : 0,
    p.contagens ? prisma.pedido.count({ where: { tenantId: id } }) : 0,
    p.cupons ? prisma.cupom.findMany({ where: { tenantId: id }, orderBy: { criadoEm: "desc" } }) : [],
    p.categorias ? prisma.categoria.findMany({ where: { tenantId: id }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { produtos: true } } } }) : [],
    p.avaliacoes ? prisma.avaliacao.findMany({ where: { tenantId: id }, orderBy: { criadoEm: "desc" }, take: 200, include: { produto: { select: { nome: true } } } }) : [],
    p.vendas ? resumoDeVendas(id) : VAZIO_VENDAS,
    p.catalogo ? diagnosticoDoFeed(id) : VAZIO_CATALOGO,
    p.vendas ? filaDeEspera(id) : [],
    p.postagem ? postagemAAcertar(id) : { etiquetas: 0, custoCentavos: 0 },
  ]);

  return {
    /** Contagens do catálogo inteiro, para a tela não afirmar número de uma fatia. */
    contagens: { semEmbalagem: semEmbalagemTotal, ativos: ativosTotal, semFoto: semFotoTotal, pedidos: pedidosTotal },
    loja: {
      slug: loja.slug,
      nome: loja.nome,
      url: urlDaLoja(loja),
      status: loja.status,
      plano: loja.plano,
      tema: temaDo(loja),
      identidade: identidadeDa(loja),
      segmento: loja.segmento,
      farmaceuticoResponsavel: loja.farmaceuticoResponsavel,
      farmaceuticoCrf: loja.farmaceuticoCrf,
      licencaSanitaria: loja.licencaSanitaria,
      autorizacaoAnvisa: loja.autorizacaoAnvisa,
      slogan: loja.slogan,
      logoUrl: loja.logoUrl,
      whatsapp: loja.whatsapp,
      emailContato: loja.emailContato,
      avisoTopo: loja.avisoTopo,
      razaoSocial: loja.razaoSocial,
      cnpj: loja.cnpj,
      endereco: loja.endereco as { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; cep?: string } | null,
      enderecoPublico: loja.enderecoPublico,
      cepOrigem: loja.cepOrigem,
      dominioPrincipal: loja.dominioPrincipal,
      bannerUrl: loja.bannerUrl,
      mpPublicKey: loja.mpPublicKey,
      // Só o fato de existir credencial; o token cifrado nunca sai daqui.
      mpConfigurado: Boolean(loja.mpAccessTokenEnc),
      // A conexão em si (conta, data) é lida do tenant pela página, como no
      // Melhor Envio; aqui vai só o que muda o formulário das chaves.
      mpPorOAuth: conectadoPorOAuth(loja),
      mpOAuthDisponivel: mercadoPagoDisponivel(),
      emailRemetente: loja.emailRemetente,
      provisionamento: (loja.provisionamento as Record<string, string>) ?? {},
      pixels: { gtmId: loja.gtmId, metaPixelId: loja.metaPixelId, ga4Id: loja.ga4Id, googleAdsId: loja.googleAdsId, googleAdsRotuloCompra: loja.googleAdsRotuloCompra, tiktokPixelId: loja.tiktokPixelId, googleMerchantId: loja.googleMerchantId, googleSeloAvaliacoes: loja.googleSeloAvaliacoes },
      freteGratisAcima: loja.freteGratisAcima,
      pedidoMinimoCentavos: loja.pedidoMinimoCentavos,
      retiradaNaLoja: loja.retiradaNaLoja,
      despachoDiasUteis: loja.despachoDiasUteis,
      estoqueBaixoEm: loja.estoqueBaixoEm,
      tabelaFrete: (loja.tabelaFrete as Array<{ ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }>) ?? [],
      entregaLocal: (loja.entregaLocal as Array<{ prefixos: string[]; nome: string; preco: number; prazoDiasUteis: number; gratisAcima?: number | null }>) ?? [],
      assinatura: {
        status: loja.assinaturaStatus,
        plano: loja.plano,
        podeTrocarPlano: !loja.assinaturaId,
        isenta: loja.cobrancaIsenta,
        precoCentavos: mensalidadeDaLoja(loja),
        planoNome: NOME_PLANO[loja.plano],
        ultimoPagamentoEm: loja.ultimoPagamentoEm?.toISOString() ?? null,
        setupPagoEm: loja.setupPagoEm?.toISOString() ?? null,
        criadoEm: loja.criadoEm.toISOString(),
        testeAte: fimDoTeste(loja).toISOString(),
        emTeste: fimDoTeste(loja).getTime() > Date.now(),
        faturas: faturas.map((f) => ({ id: f.id, centavos: f.centavos, status: f.status, pagaEm: f.pagaEm?.toISOString() ?? null, criadoEm: f.criadoEm.toISOString() })),
      },
    },
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
  };
}
