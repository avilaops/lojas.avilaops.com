/**
 * A ordem do serviço de estética automotiva, montada do catálogo da loja.
 *
 * Lavar, descontaminar, corrigir, proteger. Não é enfeite de vitrine: é o erro
 * mais caro do ramo. Quem passa cera em carro sujo sela a sujeira; quem poli
 * sem descontaminar arrasta partícula de ferro pela pintura e risca. Quem chega
 * para comprar o primeiro produto não sabe disso, e a loja que ensina a ordem
 * vende a etapa inteira em vez de um frasco solto.
 *
 * A trilha sai das categorias que a loja **já cadastrou**, reconhecidas pelo
 * nome. Não inventa categoria, não obriga a cadastrar de um jeito e não
 * pressupõe que toda loja automotiva venda as quatro etapas.
 */

/** Uma categoria, no mínimo que a trilha precisa saber sobre ela. */
export interface CategoriaDaTrilha {
  id: string;
  slug: string;
  nome: string;
}

export interface EtapaDaTrilha {
  chave: string;
  titulo: string;
  resumo: string;
}

export interface PassoDaTrilha extends EtapaDaTrilha {
  categoria: CategoriaDaTrilha;
}

/**
 * As etapas na ORDEM do processo, com as palavras que as reconhecem.
 *
 * A ordem do array é o dado, não a apresentação: dela saem a numeração na tela
 * e a noção de "próxima etapa". Mexer aqui muda o que a loja ensina.
 *
 * Os termos são propositalmente largos: cobrir "vitrificação", "coating" e
 * "selante" na mesma etapa importa mais do que separar o que o mercado trata
 * como sinônimo.
 */
export const ETAPAS: Array<EtapaDaTrilha & { termos: RegExp }> = [
  {
    chave: "lavar",
    titulo: "Lavar",
    resumo: "Tira a sujeira solta sem riscar a pintura.",
    termos: /lavagem|lava|shampoo|limpeza|higieniza/i,
  },
  {
    chave: "descontaminar",
    titulo: "Descontaminar",
    resumo: "Remove o que a lavagem não tira: ferro, piche, chuva ácida.",
    termos: /descontamina|clay|argila|remove(dor)?|ferrug/i,
  },
  {
    chave: "corrigir",
    titulo: "Corrigir",
    resumo: "Apaga risco e marca de lavagem antes de proteger.",
    termos: /polimento|polir|corre[cç]|boina|lustr/i,
  },
  {
    chave: "proteger",
    titulo: "Proteger",
    resumo: "Sela o resultado e faz durar meses, não dias.",
    termos: /prote[cç]|cera|selante|vitrifica|coating|revestimento/i,
  },
];

/**
 * Uma etapa sozinha não é uma sequência: é um atalho com título comprido, e
 * ocupa a primeira tela sem ensinar nada.
 */
export const MINIMO_DE_ETAPAS = 2;

/**
 * Monta a trilha e devolve também o que sobrou, para a grade de categorias.
 *
 * Cada categoria entra em **uma** etapa só. Sem isso, "Cera de polimento"
 * casaria com Corrigir (por "polimento") e com Proteger (por "cera"), e a
 * trilha mostraria o mesmo atalho duas vezes — o que faz a pessoa achar que
 * clicou errado.
 *
 * A ordem de teste é a ordem do processo, então em caso de empate vence a
 * etapa que vem antes: um produto de lavagem que também limpa é, na prática,
 * o começo do serviço.
 */
export function montarTrilha<C extends CategoriaDaTrilha>(
  categorias: C[],
): { trilha: PassoDaTrilha[]; restantes: C[]; mostrar: boolean } {
  const usadas = new Set<string>();

  const trilha = ETAPAS.flatMap(({ termos, ...etapa }) => {
    const categoria = categorias.find((c) => !usadas.has(c.id) && termos.test(c.nome));
    if (!categoria) return [];
    usadas.add(categoria.id);
    return [{ ...etapa, categoria }];
  });

  const mostrar = trilha.length >= MINIMO_DE_ETAPAS;

  // Sem trilha na tela, nenhuma categoria foi "gasta" por ela: todas voltam
  // para a grade, senão a loja perderia atalhos sem ganhar a sequência.
  return { trilha, restantes: mostrar ? categorias.filter((c) => !usadas.has(c.id)) : categorias, mostrar };
}
