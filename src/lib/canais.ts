/**
 * Canais de venda: o registro central, e as regras comerciais de cada um.
 *
 * Existe porque o Mercado Livre não vai ser o único. Amazon, Shopee e Magalu
 * mudam o nome do endpoint e a comissão, não a pergunta que o lojista precisa
 * responder: *por quanto* e *com quanto estoque* o meu produto vai para lá.
 * Essa pergunta é a mesma nos quatro, então a resposta mora num lugar só e o
 * canal novo entra como **dado** (uma ficha em `CANAIS`), não como tela nova.
 *
 * O que continua sendo código por canal é o que de fato difere: o OAuth, o
 * formato do anúncio e o jeito de a venda voltar. Ver `mercadolivre*.ts`.
 *
 * As regras ficam em `Tenant.canais` (JSON por canal) e não em coluna: coluna
 * por canal multiplicaria o schema por N sem responder nada a mais, e o dia em
 * que a Shopee entrar não pode ser o dia de uma migração de seis colunas.
 */

/** Canal conhecido pela plataforma. A ordem é a de exibição no painel. */
export type CanalId = "mercadolivre" | "amazon" | "shopee" | "magalu";

export interface FichaCanal {
  id: CanalId;
  nome: string;
  /**
   * `ativo`: publica e recebe venda hoje.
   * `roadmap`: a ficha existe para o lojista saber o que vai precisar; nada
   * publica. Nunca desenhamos botão de conectar para canal em roadmap — botão
   * que não conecta é promessa quebrada na primeira tentativa.
   */
  estado: "ativo" | "roadmap";
  /**
   * Comissão típica do canal em pontos percentuais, para a tela sugerir o
   * acréscimo de preço. É faixa, não verdade: a comissão real varia por
   * categoria e por plano, e quem confere é o lojista no extrato dele.
   */
  comissaoTipica: { de: number; ate: number };
  /** Por que vale a pena estar lá, em uma linha. */
  porQue: string;
  /** O que o canal exige do lojista antes de qualquer anúncio subir. */
  exigencias: string[];
}

export const CANAIS: FichaCanal[] = [
  {
    id: "mercadolivre",
    nome: "Mercado Livre",
    estado: "ativo",
    comissaoTipica: { de: 11, ate: 19 },
    porQue: "É onde o brasileiro procura produto primeiro. Conta de vendedor e conta do Mercado Pago são a mesma.",
    exigencias: [
      "Conta de vendedor com dados fiscais em dia.",
      "Marca, código (SKU) e, quando existir, GTIN de cada produto.",
      "Nota fiscal do pedido: o Mercado Livre exige na maioria das categorias e a plataforma ainda não emite.",
    ],
  },
  {
    id: "amazon",
    nome: "Amazon",
    estado: "roadmap",
    comissaoTipica: { de: 8, ate: 15 },
    porQue: "Ticket médio maior e comprador Prime, que decide pelo prazo antes de decidir pelo preço.",
    exigencias: [
      "Conta Seller Central com plano profissional (mensalidade própria da Amazon).",
      "GTIN (EAN/UPC) obrigatório por item, salvo isenção de marca aprovada por eles.",
      "Prazo de despacho cumprido: atraso derruba a conta, não só o anúncio.",
    ],
  },
  {
    id: "shopee",
    nome: "Shopee",
    estado: "roadmap",
    comissaoTipica: { de: 14, ate: 22 },
    porQue: "Giro alto em item barato, com o comprador vindo de campanha e cupom do próprio canal.",
    exigencias: [
      "Conta de vendedor aprovada e integração liberada na Shopee Open Platform.",
      "Peso e dimensão reais por produto: o frete do canal é calculado por eles a partir disso.",
      "Margem que aguente cupom do canal, que sai do bolso do vendedor em boa parte das campanhas.",
    ],
  },
  {
    id: "magalu",
    nome: "Magalu",
    estado: "roadmap",
    comissaoTipica: { de: 10, ate: 20 },
    porQue: "Marketplace com loja física por trás e forte em linha branca, móvel e construção.",
    exigencias: [
      "Cadastro aprovado no Parceiro Magalu.",
      "Ficha técnica completa: eles recusam anúncio sem atributo de categoria.",
      "Emissão de nota fiscal própria.",
    ],
  },
];

export function fichaDoCanal(id: string): FichaCanal | undefined {
  return CANAIS.find((c) => c.id === id);
}

/** Como arredondar o preço depois do acréscimo. Sempre para cima — ver `arredondar`. */
export type Arredondamento = "nenhum" | "noventa" | "inteiro";

/** Tipo de garantia, na linguagem do lojista. O mapa para o canal é de quem publica. */
export type Garantia = "sem" | "vendedor" | "fabrica";

/**
 * O que o lojista responde por canal.
 *
 * Tudo aqui é decisão comercial dele, não detalhe técnico nosso: são os campos
 * que, sem resposta, fazem a plataforma publicar no escuro. O padrão de cada um
 * é o comportamento que a integração já tinha antes destes campos existirem, de
 * propósito: quem não abrir a tela não vê nada mudar sozinho.
 */
export interface RegrasDoCanal {
  /** Publicar neste canal. Desligado não derruba anúncio: para de mandar coisa nova. */
  ativo: boolean;
  /**
   * Acréscimo sobre o preço da loja, em pontos percentuais.
   *
   * Zero é o padrão porque era o que a integração fazia — e é também o erro
   * mais caro do canal: o Mercado Livre cobra de 11% a 19% sobre a venda, e
   * quem anuncia pelo preço da própria loja está pagando para vender. A tela
   * sugere a conta; a decisão é do lojista.
   */
  acrescimoPercentual: number;
  arredondamento: Arredondamento;
  /**
   * Unidades que nunca vão para o canal. É o colchão contra venda dupla: a
   * loja e o marketplace vendem a mesma peça, e a sincronia de estoque leva
   * minutos. Com 1 reservado, a última unidade não é vendida duas vezes.
   */
  estoqueReservado: number;
  /** Teto de unidades por anúncio. Zero = sem teto. */
  estoqueMaximo: number;
  /** Produto abaixo disso não é publicado: o canal come a margem inteira. Zero desliga. */
  precoMinimoCentavos: number;
  /** `classico` aparece menos e custa menos; `premium` parcela sem juros e custa mais. */
  tipoAnuncio: "classico" | "premium";
  condicao: "novo" | "usado";
  garantia: Garantia;
  /** Meses de garantia. Ignorado quando `garantia` é "sem". */
  garantiaMeses: number;
}

export const REGRAS_PADRAO: RegrasDoCanal = {
  ativo: true,
  acrescimoPercentual: 0,
  arredondamento: "nenhum",
  estoqueReservado: 0,
  estoqueMaximo: 0,
  precoMinimoCentavos: 0,
  tipoAnuncio: "classico",
  condicao: "novo",
  garantia: "sem",
  garantiaMeses: 3,
};

const ARREDONDAMENTOS: Arredondamento[] = ["nenhum", "noventa", "inteiro"];
const GARANTIAS: Garantia[] = ["sem", "vendedor", "fabrica"];

const inteiro = (v: unknown, min: number, max: number, padrao: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : padrao;
};

/**
 * Lê as regras de um canal do JSON do tenant, sempre completas.
 *
 * Nunca devolve parcial: a publicação lê isto no meio de um lote e não pode
 * parar para decidir o que fazer com um campo ausente. Valor fora da faixa é
 * limitado em vez de recusado — o JSON pode ter vindo de uma versão anterior, e
 * derrubar a publicação inteira por causa de um número velho seria pior.
 */
export function lerRegrasDoCanal(bruto: unknown, canal: CanalId): RegrasDoCanal {
  const todos = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const c = todos[canal];
  const r = c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>) : {};

  const acrescimoBruto = typeof r.acrescimoPercentual === "number" ? r.acrescimoPercentual : Number(r.acrescimoPercentual);
  const acrescimo = Number.isFinite(acrescimoBruto) ? Math.min(300, Math.max(0, acrescimoBruto)) : REGRAS_PADRAO.acrescimoPercentual;

  return {
    ativo: typeof r.ativo === "boolean" ? r.ativo : REGRAS_PADRAO.ativo,
    // Uma casa decimal: 14,7% é conta de comissão; 14,73% é ruído na tela.
    acrescimoPercentual: Math.round(acrescimo * 10) / 10,
    arredondamento: ARREDONDAMENTOS.includes(r.arredondamento as Arredondamento)
      ? (r.arredondamento as Arredondamento)
      : REGRAS_PADRAO.arredondamento,
    estoqueReservado: inteiro(r.estoqueReservado, 0, 9_999, REGRAS_PADRAO.estoqueReservado),
    estoqueMaximo: inteiro(r.estoqueMaximo, 0, 99_999, REGRAS_PADRAO.estoqueMaximo),
    precoMinimoCentavos: inteiro(r.precoMinimoCentavos, 0, 100_000_000, REGRAS_PADRAO.precoMinimoCentavos),
    tipoAnuncio: r.tipoAnuncio === "premium" ? "premium" : "classico",
    condicao: r.condicao === "usado" ? "usado" : "novo",
    garantia: GARANTIAS.includes(r.garantia as Garantia) ? (r.garantia as Garantia) : REGRAS_PADRAO.garantia,
    garantiaMeses: inteiro(r.garantiaMeses, 1, 120, REGRAS_PADRAO.garantiaMeses),
  };
}

/** Grava as regras de um canal preservando as dos outros. */
export function gravarRegrasDoCanal(bruto: unknown, canal: CanalId, regras: RegrasDoCanal): Record<string, RegrasDoCanal> {
  const todos = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const saida: Record<string, RegrasDoCanal> = {};
  for (const c of CANAIS) {
    if (c.id === canal) continue;
    if (todos[c.id]) saida[c.id] = lerRegrasDoCanal(todos, c.id);
  }
  saida[canal] = regras;
  return saida;
}

/**
 * Arredondamento **sempre para cima**.
 *
 * Preço de canal que arredonda para baixo vende abaixo do que o lojista mandou
 * vender, e a diferença sai da margem dele sem ninguém ter decidido isso. Para
 * cima, o pior caso é o produto ficar alguns centavos mais caro que o
 * necessário — visível, reversível e dele.
 */
function arredondar(centavos: number, modo: Arredondamento): number {
  if (modo === "inteiro") return Math.ceil(centavos / 100) * 100;
  if (modo === "noventa") return Math.max(90, Math.ceil((centavos - 90) / 100) * 100 + 90);
  return centavos;
}

/** Preço em centavos com que o produto vai para o canal. */
export function precoDoCanal(precoCentavos: number, r: RegrasDoCanal): number {
  if (precoCentavos <= 0) return 0;
  return arredondar(Math.round(precoCentavos * (1 + r.acrescimoPercentual / 100)), r.arredondamento);
}

/** Estoque que o canal enxerga, depois do colchão e do teto. */
export function estoqueDoCanal(estoque: number | null | undefined, r: RegrasDoCanal): number {
  const disponivel = Math.max(0, Math.trunc(estoque ?? 0) - r.estoqueReservado);
  return r.estoqueMaximo > 0 ? Math.min(disponivel, r.estoqueMaximo) : disponivel;
}

/**
 * Acréscimo que devolve, depois da comissão, o mesmo líquido da loja.
 *
 * Não é `preço + comissão`: a comissão incide sobre o preço já acrescido. Para
 * 14% a conta certa é 16,3%, não 14% — e é justamente essa diferença que some
 * da margem de quem faz de cabeça.
 */
export function acrescimoQueCobreComissao(comissaoPercentual: number): number {
  const c = Math.min(90, Math.max(0, comissaoPercentual)) / 100;
  return Math.round((1 / (1 - c) - 1) * 1000) / 10;
}

/** Por que este produto não vai para o canal agora, se for o caso. */
export function impedimentoNoCanal(
  produto: { ativo: boolean; precoCentavos: number; estoque: number | null },
  r: RegrasDoCanal,
): string | null {
  if (!r.ativo) return "A publicação neste canal está desligada nas regras.";
  if (!produto.ativo) return "O produto está inativo na loja.";
  if (produto.precoCentavos <= 0) return "O produto não tem preço de venda.";
  if (r.precoMinimoCentavos > 0 && produto.precoCentavos < r.precoMinimoCentavos) {
    return "O preço está abaixo do mínimo que você definiu para este canal.";
  }
  if (estoqueDoCanal(produto.estoque, r) <= 0) {
    return r.estoqueReservado > 0
      ? `Sem estoque livre para o canal: ${produto.estoque ?? 0} em estoque, ${r.estoqueReservado} reservado para a loja.`
      : "O produto não tem estoque disponível.";
  }
  return null;
}
