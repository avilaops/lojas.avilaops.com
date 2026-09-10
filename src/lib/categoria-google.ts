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
 */

/** Ramo por ramo, na ordem em que as regras são testadas. */
const REGRAS: Array<{ termos: RegExp; id: number; prateleira: string }> = [
  // Estética automotiva, na ordem do serviço. Os quatro ids abaixo vivem em
  // "Veículos e peças > Peças e acessórios de veículos > Manutenção, cuidado e
  // decoração para veículos motorizados > Limpeza de veículos".
  {
    termos: /lavagem|shampoo|limpa[\s-]?rodas|limpeza\s+automotiva/i,
    id: 2590,
    prateleira: "Soluções para limpeza de carro",
  },
  {
    termos: /polimento|polir|boina|lustr/i,
    id: 2590,
    prateleira: "Soluções para limpeza de carro",
  },
  {
    termos: /vitrifica|coating|selante|\bcera\b|prote[çc][ãa]o/i,
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
 * Devolve o id da prateleira do Google para a categoria, ou `undefined`.
 *
 * @param nomeDaCategoria nome como o lojista cadastrou ("Lavagem", "Boinas e
 *   espumas", "Kits Completos").
 */
export function categoriaGoogle(nomeDaCategoria: string | null | undefined): number | undefined {
  if (!nomeDaCategoria) return undefined;
  return REGRAS.find((r) => r.termos.test(nomeDaCategoria))?.id;
}
