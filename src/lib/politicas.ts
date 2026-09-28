import type { Tenant } from "@prisma/client";
import type { Endereco } from "./tenant";
import { retiradaPublicaDisponivel } from "./retirada-publica";
import { porOndeFalarCom, prazoDeDespacho } from "./textos-loja";
import { mascararDocumento } from "@avilaops/checkout";

/**
 * Políticas da loja.
 *
 * Até aqui o texto era único da plataforma e ninguém editava: era o que
 * garantia que toda loja nova cumprisse CDC e LGPD sem revisão caso a caso.
 * Isso continua sendo o padrão — o que muda é que agora existe o passo
 * seguinte, para o lojista que precisa dizer algo que só ele sabe (prazo de
 * garantia próprio, endereço de retorno, foro).
 *
 * A composição é: **modelo da plataforma, editável**. Quem não mexe publica o
 * modelo, como sempre; quem mexe parte do modelo preenchido com os dados da
 * própria loja e ajusta. Não existe estado "sem política definida" na vitrine:
 * loja no ar sem política de devolução é infração, não é escolha de produto.
 *
 * ## Por que as regras de devolução não são um campo livre
 *
 * Shopify tem "taxa de reposição" e "frete de retorno por conta do cliente"
 * porque foi desenhada onde isso é legal. No Brasil não é: o art. 49 do CDC dá
 * 7 dias corridos de arrependimento com devolução dos valores pagos
 * *integralmente*, e o parágrafo único manda devolver monetariamente
 * atualizado — não cabe desconto de taxa nem repasse do frete de retorno.
 *
 * Um campo "taxa de reposição" aplicado à janela legal produziria política
 * ilegal com a nossa assinatura embaixo. Então ele existe, mas só vale onde há
 * liberdade real: a **cortesia** que a loja concede DEPOIS dos 7 dias. Por
 * isso `prazoDias` tem piso 7 e as condições (taxa, frete, venda final) só
 * alcançam o intervalo do 8º dia em diante.
 */

export const TIPOS_POLITICA = ["envio", "devolucao", "privacidade", "termos", "aviso-legal"] as const;
export type TipoPolitica = (typeof TIPOS_POLITICA)[number];

export const ROTULO_POLITICA: Record<TipoPolitica, string> = {
  envio: "Política de envio",
  devolucao: "Política de devolução e reembolso",
  privacidade: "Política de privacidade",
  termos: "Termos de serviço",
  "aviso-legal": "Aviso legal",
};

/** O que o lojista resolve em cada uma, na língua dele. */
export const AJUDA_POLITICA: Record<TipoPolitica, string> = {
  envio: "Prazo de despacho, entrega e o que fazer se o pedido se extraviar",
  devolucao: "Arrependimento em 7 dias, defeito e como o cliente pede a troca",
  privacidade: "Que dados a loja coleta e o que o cliente pode exigir",
  termos: "Como a compra funciona e o que vale quando algo diverge",
  "aviso-legal": "Texto livre: só publica quando você escreve",
};

/** Piso legal do arrependimento: art. 49 do CDC. Não é configuração. */
export const PRAZO_LEGAL_DIAS = 7;

export interface RegrasDevolucao {
  /**
   * Janela total de devolução por arrependimento, em dias corridos, contada do
   * recebimento. Do 1º ao 7º dia é direito; do 8º em diante é cortesia da loja.
   */
  prazoDias: number;
  /**
   * Taxa de reposição, em pontos percentuais do valor do item, aplicada **só
   * na cortesia** (8º dia em diante). Zero = sem taxa.
   */
  taxaReposicaoPct: number;
  /** Quem paga o frete de retorno **na cortesia**. Na janela legal é sempre a loja. */
  freteRetornoCortesia: "loja" | "cliente";
  /**
   * Prazo para cancelar item ainda não separado, em horas a partir da compra.
   * Zero = a loja não promete janela de cancelamento; vale falar com ela.
   */
  cancelamentoHoras: number;
  /**
   * Slugs de categoria em venda final: sem cortesia depois dos 7 dias. Slug do
   * catálogo, não lista escrita no código — ver src/lib/categorias.ts.
   */
  categoriasVendaFinal: string[];
}

export const REGRAS_PADRAO: RegrasDevolucao = {
  prazoDias: PRAZO_LEGAL_DIAS,
  taxaReposicaoPct: 0,
  freteRetornoCortesia: "cliente",
  cancelamentoHoras: 0,
  categoriasVendaFinal: [],
};

/** Lê as regras gravadas, corrigindo o que vier fora da faixa em vez de confiar. */
export function lerRegrasDevolucao(bruto: unknown): RegrasDevolucao {
  const r = (bruto ?? {}) as Partial<RegrasDevolucao>;
  const inteiro = (v: unknown, padrao: number, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
  };
  return {
    // Piso 7 no próprio leitor: regra gravada abaixo do CDC (por bug, por
    // importação ou por chamada direta na API) nunca chega a virar texto.
    prazoDias: inteiro(r.prazoDias, PRAZO_LEGAL_DIAS, PRAZO_LEGAL_DIAS, 365),
    taxaReposicaoPct: inteiro(r.taxaReposicaoPct, 0, 0, 50),
    freteRetornoCortesia: r.freteRetornoCortesia === "loja" ? "loja" : "cliente",
    cancelamentoHoras: inteiro(r.cancelamentoHoras, 0, 0, 720),
    categoriasVendaFinal: Array.isArray(r.categoriasVendaFinal)
      ? r.categoriasVendaFinal.filter((s): s is string => typeof s === "string" && s.length > 0).slice(0, 50)
      : [],
  };
}

/**
 * A política de troca como `MerchantReturnPolicy`, para a loja (`Store`) no
 * JSON-LD. O Google prefere a política declarada no nível da organização a
 * repeti-la em cada oferta. Sai do mesmo leitor que escreve o texto de
 * `/politicas/devolucao`, então o dado estruturado e a página dizem o mesmo.
 *
 * `returnFees` só é afirmado quando é verdade para o prazo inteiro: no prazo
 * legal o frete de volta é da loja (CDC, art. 49); depois dele, na cortesia,
 * vale o que o lojista escolheu. Prazo maior que o legal com retorno pago pelo
 * cliente é misto, e o schema não tem como dizer isso: fica sem o campo.
 */
export function politicaDevolucaoSchema(regras: RegrasDevolucao, url: string) {
  const gratis = regras.prazoDias <= PRAZO_LEGAL_DIAS || regras.freteRetornoCortesia === "loja";
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BR",
    returnPolicyCountry: "BR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: regras.prazoDias,
    ...(gratis && regras.taxaReposicaoPct === 0 ? { returnFees: "https://schema.org/FreeReturn" } : {}),
    merchantReturnLink: url,
  };
}

export interface PoliticaEscrita {
  corpo: string;
  atualizadoEm: string;
}

/** Lê o mapa de políticas próprias, ignorando chave desconhecida e corpo vazio. */
export function lerPoliticasEscritas(bruto: unknown): Partial<Record<TipoPolitica, PoliticaEscrita>> {
  const fonte = (bruto ?? {}) as Record<string, unknown>;
  const saida: Partial<Record<TipoPolitica, PoliticaEscrita>> = {};
  for (const tipo of TIPOS_POLITICA) {
    const v = fonte[tipo] as Partial<PoliticaEscrita> | undefined;
    const corpo = typeof v?.corpo === "string" ? v.corpo.trim() : "";
    if (!corpo) continue;
    saida[tipo] = { corpo, atualizadoEm: typeof v?.atualizadoEm === "string" ? v.atualizadoEm : "" };
  }
  return saida;
}

// ── Modelo da plataforma ────────────────────────────────────────────────

/** Nome de quem vende, com CNPJ quando existe: repete em vários modelos. */
function vendedor(t: Tenant): string {
  const empresa = t.razaoSocial ?? t.nome;
  return t.cnpj ? `${empresa}, CNPJ ${mascararDocumento(t.cnpj)}` : empresa;
}


/**
 * O texto padrão da plataforma, preenchido com os dados da loja.
 *
 * Só entra aqui fato verificável (como a loja funciona, o que o cadastro diz)
 * ou lei que não depende de escolha do lojista. Nada de prazo de garantia
 * próprio ou foro: isso é decisão comercial e, se inventado aqui, vira promessa
 * que o lojista terá de cumprir sem nunca ter feito.
 */
export function modeloDePolitica(t: Tenant, tipo: TipoPolitica): string[] {
  // `enderecoDo` de tenant.ts faria o mesmo, mas aquele módulo importa
  // `next/headers`: bastaria essa linha para o painel arrastar código de
  // servidor inteiro para o navegador, já que a tela de Políticas é cliente.
  const e = (t.endereco as Endereco | null) ?? {};
  const cidade = e.cidade ? `${e.cidade}${e.uf ? "/" + e.uf : ""}` : "nossa loja";
  const contato = porOndeFalarCom(t);
  const regras = lerRegrasDevolucao(t.regrasDevolucao);

  switch (tipo) {
    case "envio":
      return [
        `${t.despachoDiasUteis === 0
          ? "Pedidos pagos durante o expediente em dia útil são despachados no mesmo dia; confirmações fora do expediente seguem no próximo dia útil."
          : `Os pedidos são despachados ${prazoDeDespacho(t.despachoDiasUteis)} após a confirmação do pagamento.`} O prazo de entrega é o informado na cotação de frete no momento da compra e depende da transportadora e do CEP de destino.`,
        retiradaPublicaDisponivel(t)
          ? `Você pode retirar o pedido sem custo em ${cidade}, a partir do próximo dia útil após a confirmação. Aguarde o aviso de "pedido separado" antes de ir até a loja.`
          : "Esta loja não oferece retirada no balcão.",
        `Em caso de avaria no transporte ou extravio, comunique-nos ${contato} com fotos da embalagem. A reposição ou o estorno são por nossa conta.`,
      ];

    case "devolucao":
      return textoDaDevolucao(regras, contato);

    case "privacidade":
      return [
        `A ${vendedor(t)} é a controladora dos seus dados e coleta apenas os necessários para processar o pedido: nome, CPF/CNPJ, e-mail, telefone e endereço de entrega. Eles são usados para emitir a cobrança, entregar o produto e prestar atendimento, nos termos da Lei 13.709/2018 (LGPD).`,
        "Dados de cartão não passam por nossos servidores: são tokenizados pelo provedor de pagamento no seu navegador.",
        `Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento ${contato}. Os dados de pedidos são mantidos pelo prazo exigido pela legislação fiscal.`,
        "Esta loja usa cookies estritamente necessários para o funcionamento do carrinho e, quando configurado, ferramentas de medição de audiência.",
      ];

    case "termos":
      return [
        `Estes termos valem para o uso da loja da ${vendedor(t)}. Navegar e comprar significa concordar com eles.`,
        "A loja apresenta os produtos, o preço e as condições de entrega, e a compra é feita aqui mesmo: você monta o carrinho, escolhe o frete e paga online. O contrato de venda se forma quando o pagamento é confirmado pelo provedor de pagamento.",
        "Preço, disponibilidade e prazo são os exibidos no momento da compra. Erros evidentes de cadastro (preço incompatível com o produto, por exemplo) não obrigam a loja à venda: nesse caso o pedido é cancelado e o valor devolvido integralmente.",
        "As imagens são ilustrativas do produto anunciado. Embalagem, rótulo e apresentação podem mudar por conta do fabricante sem aviso prévio.",
        "Use os produtos conforme a orientação do fabricante no rótulo. Quando a instrução do rótulo divergir de qualquer texto desta loja, é o rótulo que vale.",
        "O conteúdo da loja (textos, fotos, marca e organização do catálogo) pertence a quem o produziu e não pode ser copiado sem autorização.",
        `Dúvida sobre estes termos, sobre um pedido ou sobre um produto: fale conosco ${contato}.`,
      ];

    /**
     * Aviso legal não tem modelo, e é de propósito.
     *
     * É a página onde cabem restrição de idade, registro profissional e
     * ressalva de resultado — coisas que dependem do que a loja vende e que
     * ninguém pode escrever no lugar dela. Modelo genérico aqui só serviria
     * para ser publicado sem leitura.
     */
    case "aviso-legal":
      return [];
  }
}

/**
 * O texto de devolução é o único que a loja mexe por número, e não por prosa:
 * o que o lojista decide em Regras vira frase aqui sozinho. É isso que impede
 * o caso clássico de o painel dizer 30 dias e a política dizer 7.
 */
function textoDaDevolucao(regras: RegrasDevolucao, contato: string): string[] {
  const p: string[] = [
    `Compras feitas pela internet podem ser desfeitas em até ${PRAZO_LEGAL_DIAS} dias corridos após o recebimento, sem necessidade de justificativa, conforme o art. 49 do Código de Defesa do Consumidor. O produto deve ser devolvido sem uso e na embalagem original; o valor pago, incluindo o frete, é estornado integralmente pelo mesmo meio de pagamento, e o frete de retorno é por nossa conta.`,
  ];

  if (regras.prazoDias > PRAZO_LEGAL_DIAS) {
    const condicoes: string[] = [];
    if (regras.freteRetornoCortesia === "cliente") condicoes.push("o frete de retorno fica por conta do cliente");
    else condicoes.push("o frete de retorno continua por nossa conta");
    if (regras.taxaReposicaoPct > 0) condicoes.push(`descontamos ${regras.taxaReposicaoPct}% do valor do item a título de reposição`);
    p.push(
      `Além do prazo legal, aceitamos devolução por arrependimento até o ${regras.prazoDias}º dia após o recebimento, como cortesia. Nesse período ${condicoes.join(" e ")}. O produto precisa estar sem uso, completo e na embalagem original.`,
    );
  }

  if (regras.categoriasVendaFinal.length > 0) {
    p.push(
      `Itens de venda final não têm a cortesia descrita acima: passados os ${PRAZO_LEGAL_DIAS} dias de arrependimento previstos em lei, eles não são aceitos de volta por gosto ou desistência. A condição de venda final é informada na página do produto antes da compra.`,
    );
  }

  p.push(
    "Produto com defeito pode ser trocado em até 30 dias (não duráveis) ou 90 dias (duráveis) a contar do recebimento, conforme o art. 26 do Código de Defesa do Consumidor. Nesses casos o custo do retorno é sempre da loja, inclusive fora dos prazos de arrependimento acima.",
  );

  if (regras.cancelamentoHoras > 0) {
    p.push(
      `Pedido ainda não separado pode ser cancelado em até ${regras.cancelamentoHoras} hora(s) após a compra, com estorno integral. Depois da separação, o cancelamento passa a seguir as regras de devolução.`,
    );
  }

  p.push(`Para iniciar uma troca, devolução ou cancelamento, fale conosco ${contato} informando o número do pedido.`);
  return p;
}

// ── O que a vitrine publica ─────────────────────────────────────────────

export interface PoliticaPublicada {
  tipo: TipoPolitica;
  titulo: string;
  paragrafos: string[];
  /** Verdadeiro quando o texto é do lojista, e não o modelo da plataforma. */
  propria: boolean;
}

/**
 * O texto que vai ao ar: o do lojista quando existe, senão o modelo.
 *
 * Devolve `null` só quando não há nem um nem outro — hoje, apenas o aviso
 * legal em branco, que por isso não ganha link no rodapé.
 */
export function politicaPublicada(t: Tenant, tipo: TipoPolitica): PoliticaPublicada | null {
  const propria = lerPoliticasEscritas(t.politicas)[tipo];
  const titulo = ROTULO_POLITICA[tipo];
  if (propria) return { tipo, titulo, paragrafos: emParagrafos(propria.corpo), propria: true };
  const modelo = modeloDePolitica(t, tipo);
  return modelo.length ? { tipo, titulo, paragrafos: modelo, propria: false } : null;
}

/** Quais políticas esta loja publica hoje — é o que o rodapé lista. */
export function politicasPublicadas(t: Tenant): PoliticaPublicada[] {
  return TIPOS_POLITICA.map((tipo) => politicaPublicada(t, tipo)).filter((p): p is PoliticaPublicada => p !== null);
}

/**
 * Texto do lojista → parágrafos.
 *
 * Linha em branco separa parágrafo, e nada mais é interpretado. O que o
 * lojista escreve não vira marcação: a vitrine imprime texto, então nem HTML
 * colado de outro site nem script entram na página de política.
 */
export function emParagrafos(corpo: string): string[] {
  return corpo
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
