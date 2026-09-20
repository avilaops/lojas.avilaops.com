/**
 * Prateleira do Google para a categoria da loja.
 *
 * `product_type` é a NOSSA categoria, texto livre, e serve para organizar
 * campanha. `google_product_category` é a prateleira do Google, e é ela que
 * decide em que busca o anúncio entra. Sem o segundo, o Google adivinha pelo
 * título — e adivinha mal: a taxonomia tem "ceras naturais para vela" e
 * "polidores de piso" esperando para receber cera automotiva e boina de
 * polimento. Categoria errada é anúncio disputando a busca errada, com clique
 * caro e conversão nenhuma.
 *
 * O reconhecimento é por palavra no nome da categoria, e não por uma tabela
 * fixa de ids por loja: cada lojista nomeia as suas do jeito que quer, e
 * obrigá-lo a escolher numa lista de 5.595 linhas seria transferir para ele um
 * trabalho que ele faria errado.
 *
 * Os ids saem da taxonomia oficial em pt-BR, conferidos um a um em 08/09/2026:
 * https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt
 *
 * Vale o número, não o nome: o texto muda de tradução em tradução. Ao mexer
 * aqui, CONFIRA na lista — os ids não seguem lógica nenhuma e o mesmo número
 * vira outra coisa entre ramos (2620, por exemplo, é fio dental, não cera).
 *
 * Categoria que não casar com nada não recebe o campo, e isso é de propósito:
 * deixar o Google adivinhar é melhor do que afirmar a prateleira errada.
 *
 * Há nomes que só dizem a prateleira depois de se saber o ramo da loja.
 * "Acessórios" e "Moto" são os dois casos no catálogo de hoje: numa loja de
 * estética automotiva são pincel e lava-motos; numa de beleza ou numa pet são
 * outra coisa inteiramente. Para esses, ver `prateleirasDaLoja`, que lê o ramo
 * nas OUTRAS categorias da mesma loja antes de decidir.
 */

/** Ramo por ramo, na ordem em que as regras são testadas. */
const REGRAS: Array<{ termos: RegExp; id: number; prateleira: string }> = [
  // Tipos de abraçadeira da Vedashow variam; aguardar confirmação do uso.
  { termos: /^alicates?$/i, id: 1958, prateleira: "Alicates" },
  { termos: /^arruelas?$/i, id: 2195, prateleira: "Arruelas" },
  { termos: /^correntes?$/i, id: 1492, prateleira: "Correntes" },
  { termos: /^estiletes?$/i, id: 2198, prateleira: "Estiletes" },
  { termos: /^ferragens?$/i, id: 632, prateleira: "Ferragens" },
  { termos: /^ferramentas?$/i, id: 1167, prateleira: "Ferramentas" },
  { termos: /^molas?$/i, id: 499933, prateleira: "Molas" },
  { termos: /^parafusos?$/i, id: 2251, prateleira: "Parafusos" },
  { termos: /^serras?$/i, id: 1235, prateleira: "Serras" },
  { termos: /^torneiras?$/i, id: 2032, prateleira: "Torneiras" },
  // Estética automotiva, na ordem do serviço. Os quatro ids abaixo vivem em
  // "Veículos e peças > Peças e acessórios de veículos > Manutenção, cuidado e
  // decoração para veículos motorizados > Limpeza de veículos".
  {
    termos: /lavagem|shampoo|limpa[\\s-]?rodas|limpeza\\s+automotiva/i,
    id: 2590,
    prateleira: "Soluções para limpeza de carro",
  },
  {
    termos: /polimento|polir|boina|lustr/i,
    id: 2590,
    prateleira: "Soluções para limpeza de carro",
  },
  {
    termos: /vitrifica|coating|selante|\\bcera\\b|prote[çc][ãa]o/i,
    id: 2643,
    prateleira: "Ceras, graxas e protetores de veículos",
  },
  {
    termos: /pincel|escova|pano|microfibra|aplicador/i,
    id: 2894,
    prateleira: "Escovas para limpeza de carro",
  },
  // Kits e o guarda-chuva do ramo, um nível acima.
  {
    termos: /kit|automotiv|est[ée]tica/i,
    id: 2895,
    prateleira: "Limpeza de veículos",
  },
];

/**
 * Termos que praticamente só aparecem em loja de estética automotiva, e por
 * isso servem de prova do ramo. São de propósito mais estreitos que as REGRAS:
 * aqui um falso positivo não erra uma categoria, erra a loja inteira. Ficam de
 * fora os genéricos que qualquer ramo usa — "kit", "cera" (vela), "proteção".
 */
const SINAL_DO_RAMO = /vitrifica|coating|polimento|boina|automotiv|limpa[\\s-]?rodas|snow\\s*foam|descontamina/i;

/**
 * Regras que só valem com o ramo já provado pelo SINAL_DO_RAMO. Sozinhos,
 * estes nomes não dizem nada: toda loja tem "Acessórios".
 */
const REGRAS_DO_RAMO: Array<{ termos: RegExp; id: number; prateleira: string }> = [
  {
    termos: /acess[óo]rio/i,
    id: 2894,
    prateleira: "Escovas para limpeza de carro",
  },
  {
    // \\bmotos?\\b não casa com "automotivo" nem com "motor".
    termos: /\\bmotos?\\b|motocicl/i,
    id: 2895,
    prateleira: "Limpeza de veículos",
  },
];

/**
 * Devolve o id da prateleira do Google para a categoria, ou `undefined`.
 *
 * @param nomeDaCategoria nome como o lojista cadastrou ("Lavagem", "Boinas e
 *   espumas", "Kits Completos").
 */
export function categoriaGoogle(nomeDaCategoria: string | null | undefined): number | undefined {
  if (!nomeDaCategoria) return undefined;
  return REGRAS.find((r) => r.termos.test(nomeDaCategoria))?.id;
}

/**
 * Resolvedor para uma loja inteira, com as categorias dela como contexto.
 *
 * Chamar uma vez por feed e reusar: o ramo é da loja, não do produto. As
 * categorias de nome próprio continuam valendo por si; as genéricas só recebem
 * prateleira se as vizinhas provarem o ramo.
 *
 * @param nomes nomes de TODAS as categorias da loja (repetição não atrapalha).
 */
export function prateleirasDaLoja(nomes: Array<string | null | undefined>): (nomeDaCategoria: string | null | undefined) => number | undefined {
  const automotiva = nomes.some((n) => !!n && SINAL_DO_RAMO.test(n));
  return (nomeDaCategoria) => {
    if (!nomeDaCategoria) return undefined;
    const direta = categoriaGoogle(nomeDaCategoria);
    if (direta !== undefined) return direta;
    if (!automotiva) return undefined;
    return REGRAS_DO_RAMO.find((r) => r.termos.test(nomeDaCategoria))?.id;
  };
}
