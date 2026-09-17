import type { TemaLoja } from "./tema";
import { montarTrilha, type CategoriaDaTrilha } from "./trilha-automotiva";

/**
 * As etapas da home do template Automotivo Premium.
 *
 * O template nasceu pedindo que o lojista escrevesse as etapas na aba Marca.
 * Quem escolhe o layout e não preenche nada fica sem a seção que justifica o
 * template — a primeira tela perde o bloco que ensina a ordem do serviço, que é
 * exatamente o que o ramo não sabe (ver `trilha-automotiva.ts`).
 *
 * Então: o que o lojista escreveu vale sempre; o que ele não escreveu sai do
 * catálogo que ele já cadastrou, pela mesma trilha do layout Automotivo. Sem
 * inventar categoria e sem `if` por loja — continua sendo dado.
 */
export type EtapaPremium = NonNullable<NonNullable<TemaLoja["premium"]>["etapas"]>[number];
export type IconePremium = EtapaPremium["icone"];

/**
 * Ícone de cada etapa da trilha. É tradução entre dois vocabulários nossos
 * (as quatro etapas do serviço e os sete pictogramas do template), não
 * adivinhação: descontaminar é trabalho de clay e aplicador, daí `acessorios`.
 */
const ICONE_DA_TRILHA: Record<string, IconePremium> = {
  lavar: "lavagem",
  descontaminar: "acessorios",
  corrigir: "polimento",
  proteger: "protecao",
};

/**
 * Pictograma pelo nome da categoria, do mais específico para o mais genérico.
 *
 * A grade de categorias do template desenhava o ícone pelo slug exato, então
 * "lavagem" acertava e "lavagem-automotiva" caía no escudo genérico — a fileira
 * inteira virava escudo em qualquer loja que não tivesse batizado a categoria
 * com o nome do pictograma. Aqui vale o vocabulário, como no resto do projeto.
 */
const VOCABULARIO: Array<[IconePremium, RegExp]> = [
  ["moto", /moto|motocicl|capacete/i],
  ["kits", /\bkits?\b|combo|conjunto/i],
  ["acessorios", /acess[óo]rio|microfibra|pincel|aplicador|toalha|pano|escova|luva|balde|boina/i],
  ["vitrificacao", /vitrifica|coating|cer[âa]mic|revestimento/i],
  ["protecao", /prote[çc]|cera|selante|impermeabiliz/i],
  ["polimento", /polimento|polir|corre[çc]|lustr|abrasiv/i],
  ["lavagem", /lavagem|lava|shampoo|limpeza|higieniza|descontamina|clay|argila/i],
];

/** O pictograma que cabe na categoria; escudo quando nada é reconhecido. */
export function iconeDaCategoria(...textos: Array<string | null | undefined>): IconePremium {
  const alvo = textos.filter(Boolean).join(" ");
  return VOCABULARIO.find(([, termos]) => termos.test(alvo))?.[0] ?? "protecao";
}

/**
 * A categoria da loja que corresponde a um pictograma, quando existe.
 *
 * O bloco editorial de acessórios do template apontava para `/categoria/acessorios`
 * escrito na mão: em qualquer loja que não tivesse essa categoria com esse slug,
 * o botão levava a um 404. Aqui o destino sai do catálogo — e some quando a loja
 * não vende aquilo.
 */
export function categoriaPorPictograma<C extends CategoriaDaTrilha>(
  icone: IconePremium,
  categorias: C[],
): C | null {
  return categorias.find((c) => iconeDaCategoria(c.nome, c.slug) === icone) ?? null;
}

/**
 * Etapas prontas para a tela, já garantidas contra categoria apagada.
 *
 * Devolve vazio quando não há o que mostrar (nem configuração, nem trilha
 * reconhecida no catálogo): a home some com a seção em vez de exibir um título
 * sobre uma fileira vazia.
 */
export function etapasDoPremium<C extends CategoriaDaTrilha>(
  premium: TemaLoja["premium"],
  categorias: C[],
): EtapaPremium[] {
  const escritas = (premium?.etapas ?? []).filter((e) => categorias.some((c) => c.slug === e.categoria));
  if (escritas.length > 0) return escritas;

  const { trilha, mostrar } = montarTrilha(categorias);
  if (!mostrar) return [];
  return trilha.map((passo) => ({
    categoria: passo.categoria.slug,
    titulo: passo.titulo,
    texto: passo.resumo,
    icone: ICONE_DA_TRILHA[passo.chave] ?? iconeDaCategoria(passo.categoria.nome, passo.categoria.slug),
  }));
}
