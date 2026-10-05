import type { Categoria, Pedido, PedidoItem, Produto, Tenant, Variante } from "@prisma/client";
import { dispensavelADistancia, estadoDeVenda, estoqueBaixo, sobConsulta, type AcaoDeVenda } from "./produto-regras";

/**
 * O que cada recurso da API mostra: as projeções, num lugar só.
 *
 * O formato que sai daqui é contrato público — integração de cliente quebra
 * se um campo some ou muda de tipo. Por isso a projeção é explícita, campo a
 * campo, e nunca `...produto`: coluna nova no banco não pode aparecer na API
 * sem alguém decidir que ela é pública (a `busca`, o `versaoCatalogo` e as
 * colunas de token são exatamente o que não deve vazar).
 *
 * Duas visões do produto, porque são duas chaves:
 *   produtoDaApi     chave secreta: o cadastro como o lojista vê no painel.
 *   produtoDaVitrine chave publicável: o que a página do produto já mostra.
 *
 * Dinheiro em centavos inteiros (`*Centavos`), como no resto da plataforma.
 */

type ProdutoComCategoria = Produto & { categoria: Pick<Categoria, "id" | "slug" | "nome"> | null };

function categoriaDe(p: ProdutoComCategoria) {
  return p.categoria ? { id: p.categoria.id, slug: p.categoria.slug, nome: p.categoria.nome } : null;
}

function varianteDaApi(v: Variante) {
  return {
    id: v.id,
    nome: v.nome,
    valores: v.valores,
    sku: v.sku,
    gtin: v.gtin,
    // Nulo = herda do produto. A API não resolve a herança por conta própria
    // para o ERP saber o que foi cadastrado de fato na variação.
    precoCentavos: v.precoCentavos,
    estoque: v.estoque,
    disponibilidade: v.disponibilidade,
    imagem: v.imagem,
    ativo: v.ativo,
  };
}

export function produtoDaApi(p: ProdutoComCategoria, urlLoja: string, variantes?: Variante[]) {
  return {
    id: p.id,
    slug: p.slug,
    nome: p.nome,
    sku: p.sku,
    gtin: p.gtin,
    marca: p.marca,
    categoria: categoriaDe(p),
    precoCentavos: p.precoCentavos,
    precoDeCentavos: p.precoDeCentavos,
    moeda: "BRL" as const,
    ativo: p.ativo,
    destaque: p.destaque,
    disponibilidade: p.disponibilidade,
    estoque: p.estoque,
    imagens: p.imagens,
    descricaoCurta: p.descricaoCurta,
    descricao: p.descricao,
    opcoes: p.opcoes,
    camposPersonalizados: p.camposPersonalizados,
    pesoKg: p.pesoKg,
    dimensoesCm: { altura: p.alturaCm, largura: p.larguraCm, comprimento: p.comprimentoCm },
    url: `${urlLoja}/produtos/${p.slug}`,
    criadoEm: p.criadoEm.toISOString(),
    atualizadoEm: p.atualizadoEm.toISOString(),
    ...(variantes ? { variantes: variantes.map(varianteDaApi) } : {}),
  };
}

/**
 * A ação de venda que a API publica.
 *
 * É a de `estadoDeVenda`, mais a regra da farmácia que a vitrine aplica no
 * componente: medicamento de controle especial aparece, com preço, mas não vai
 * para o carrinho (RDC 44/2009, art. 62). Front feito por terceiro não pode ter
 * de saber disso para não oferecer o botão — a resposta já vem dizendo.
 */
export type AcaoDaVitrine = AcaoDeVenda | "somente-na-loja";

export function produtoDaVitrine(p: ProdutoComCategoria, loja: { url: string; vende: boolean }) {
  const estado = estadoDeVenda(p, loja);
  const somenteNaLoja = !dispensavelADistancia(p) && (estado.acao === "carrinho" || estado.acao === "pedido");
  const acao: AcaoDaVitrine = somenteNaLoja ? "somente-na-loja" : estado.acao;
  return {
    id: p.id,
    slug: p.slug,
    nome: p.nome,
    marca: p.marca,
    categoria: categoriaDe(p),
    // Sob consulta é nulo, não zero: zero centavos num front alheio vira "Grátis".
    precoCentavos: sobConsulta(p) ? null : p.precoCentavos,
    precoDeCentavos: sobConsulta(p) ? null : p.precoDeCentavos,
    moeda: "BRL" as const,
    imagens: p.imagens,
    descricaoCurta: p.descricaoCurta,
    destaque: p.destaque,
    venda: {
      acao,
      esgotado: estado.esgotado,
      disponibilidade: estado.disponibilidade,
      // A vitrine mostra "últimas unidades", não a contagem: o estoque exato é
      // dado do lojista, e numa chave pública vira relatório para o concorrente.
      ultimasUnidades: estoqueBaixo(p),
    },
    url: `${loja.url}/produtos/${p.slug}`,
  };
}

export function lojaDaApi(t: Tenant, url: string) {
  return {
    slug: t.slug,
    nome: t.nome,
    plano: t.plano,
    status: t.status,
    segmento: t.segmento,
    url,
    moeda: "BRL" as const,
    criadaEm: t.criadoEm.toISOString(),
  };
}

/** O que a vitrine pública da loja já diz a qualquer visitante. */
export function lojaDaVitrine(t: Tenant, url: string, vende: boolean) {
  return {
    slug: t.slug,
    nome: t.nome,
    slogan: t.slogan,
    segmento: t.segmento,
    url,
    logoUrl: t.logoUrl,
    whatsapp: t.whatsapp,
    vende,
    moeda: "BRL" as const,
    freteGratisAcimaCentavos: t.freteGratisAcima,
    avisoTopo: t.avisoTopo,
  };
}

export function pedidoDaApi(p: Pedido & { itens: PedidoItem[]; postagem?: { codigoObjeto: string | null } | null }) {
  return {
    id: p.id,
    referencia: p.referencia,
    numero: p.numero,
    status: p.status,
    canal: p.canal,
    cliente: {
      nome: p.clienteNome,
      email: p.clienteEmail,
      telefone: p.clienteTelefone,
      documento: p.clienteDocumento,
    },
    entrega: p.entrega,
    frete: { nome: p.freteNome, centavos: p.freteCentavos },
    itens: p.itens.map((i) => ({
      produtoId: i.produtoId,
      varianteId: i.varianteId,
      nome: i.nome,
      varianteNome: i.varianteNome,
      sku: i.sku,
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.precoUnitarioCentavos,
    })),
    subtotalCentavos: p.subtotalCentavos,
    descontoCentavos: p.descontoCentavos,
    cupom: p.cupomCodigo,
    totalCentavos: p.totalCentavos,
    moeda: "BRL" as const,
    pagamento: { meio: p.meioPagamento, status: p.pagamentoStatus },
    rastreio: p.rastreio ?? p.postagem?.codigoObjeto ?? null,
    criadoEm: p.criadoEm.toISOString(),
    atualizadoEm: p.atualizadoEm.toISOString(),
  };
}
