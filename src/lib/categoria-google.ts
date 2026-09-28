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
  // Categorias com correspondência direta e exata na taxonomia pt-BR.
  // “Abraçadeiras” mistura tipos de produto na Vedashow, então fica sem
  // categoria Google até confirmar o uso de cada item.
  {
    termos: /^alicates?$/i,
    id: 1958,
    prateleira: "Alicates",
  },
  {
    termos: /^arruelas?$/i,
    id: 2195,
    prateleira: "Arruelas",
  },
  {
    termos: /^brocas?$/i,
    id: 1540,
    prateleira: "Brocas para furadeiras",
  },
  {
    termos: /^correntes?$/i,
    id: 1492,
    prateleira: "Correntes",
  },
  {
    termos: /^cadeados?$/i,
    id: 1974,
    prateleira: "Cadeados e chaves",
  },
  {
    termos: /^discos?\s+flap$/i,
    id: 4487,
    prateleira: "Acessórios para ferramentas > Acessórios para lixamento",
  },
  {
    termos: /^estiletes?$/i,
    id: 2198,
    prateleira: "Estiletes",
  },
  {
    termos: /^tintas?\s+spray$/i,
    id: 1361,
    prateleira: "Consumíveis para construção > Consumíveis para pintura > Tinta",
  },
  {
    termos: /^ferragens?$/i,
    id: 632,
    prateleira: "Ferragens",
  },
  {
    termos: /^ferramentas?$/i,
    id: 1167,
    prateleira: "Ferramentas",
  },
  {
    termos: /^molas?$/i,
    id: 499933,
    prateleira: "Molas",
  },
  {
    termos: /^parafusos?$/i,
    id: 2251,
    prateleira: "Parafusos",
  },
  {
    termos: /^porcas?$/i,
    id: 1739,
    prateleira: "Porcas e parafusos",
  },
  {
    termos: /^serras?$/i,
    id: 1235,
    prateleira: "Serras",
  },
  {
    termos: /^torneiras?$/i,
    id: 2032,
    prateleira: "Torneiras",
  },
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
 * Termos que praticamente só aparecem em loja de estética automotiva, e por
 * isso servem de prova do ramo. São de propósito mais estreitos que as REGRAS:
 * aqui um falso positivo não erra uma categoria, erra a loja inteira. Ficam de
 * fora os genéricos que qualquer ramo usa — "kit", "cera" (vela), "proteção".
 */
const SINAL_DO_RAMO = /vitrifica|coating|polimento|boina|automotiv|limpa[\s-]?rodas|snow\s*foam|descontamina/i;

/**
 * Uma distribuidora de peças industriais tem muitas famílias sem equivalente
 * específico na taxonomia (retentores, mancais, O-rings e rolamentos industriais
 * não aparecem como folhas). A categoria pai oficial é mais precisa do que
 * deixar o Merchant inferir a área pelo título. Só usar o pai depois que as
 * próprias categorias provarem que esta é uma loja industrial.
 */
const SINAL_INDUSTRIAL = /retentores?|rolamentos?|o[\s-]?rings?|gaxetas?|raspadores?|mancais?|correias?|buchas?|rodas\s+dentadas?|an[ée]is\s+(?:backup|el[áa]sticos?)|vedações?|hidráulica/i;
// O fallback 111 só é apropriado para estas famílias da Vedashow, cujo
// catálogo observado é de componentes industriais. Categorias genéricas ou
// com mistura de itens domésticos, elétricos e industriais ficam sem chute.
const CATEGORIAS_INDUSTRIAIS = /^(?:rolamentos?|correias?|mancais?|buchas?|mangueiras?|retentores?|gaxetas?|raspadores?|o[\s-]?rings?|rodas\s+dentadas?|an[ée]is\s+(?:backup|el[áa]sticos?)|guias|acoplamentos?|polias|cord[õo]es|veda[çc][õo]es)$/i;

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
    // "Aromatizantes" numa loja de casa é fragrância doméstica; aqui é o
    // odorizador de carro, que tem folha própria na taxonomia.
    termos: /aromatiz|odoriz/i,
    id: 2789,
    prateleira: "Decoração automotiva > Odorizadores para carro",
  },
  {
    // \bmotos?\b não casa com "automotivo" nem com "motor".
    termos: /\bmotos?\b|motocicl/i,
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

/** Corrige produtos cuja família real é mais específica que a categoria da loja. */
export function categoriaGoogleProduto(
  nomeProduto: string,
  nomeDaCategoria: string | null | undefined,
  prateleira: (nome: string | null | undefined) => number | undefined = categoriaGoogle,
): number | undefined {
  const nome = nomeProduto.normalize("NFD").replace(/\p{M}+/gu, "").trim().toLowerCase();
  const categoria = (nomeDaCategoria ?? "").normalize("NFD").replace(/\p{M}+/gu, "").trim().toLowerCase();
  if (/^fita ades\.?\s*p\/emb\b/.test(nome)) return 975;
  if (/^bom-?13(?:04|05|21)\b.*\b(?:demarcacao|marcacao)\b|^fita\b.*\b(?:demarcacao|marcacao)\b.*(?:\bpiso\b|\bsinalizacao\b)/.test(nome) && /^fitas?$/.test(categoria)) return 976;
  if (/\bbom-?1314\b|^fita\b.*\b(?:impermeavel|ipermeavel)\b/.test(nome) && /^fitas?$/.test(categoria)) return 503744;
  if (/^cantoneira eva estacionamento\b/.test(nome) && /^cantoneiras?$/.test(categoria)) return 503744;
  if (/^sabonete\b/.test(nome) && /^(?:quimicos|outros)$/.test(categoria)) return 2503;
  if (/^lanca jato turbo\b/.test(nome) && /^hidraulica$/.test(categoria)) return 6328;
  if (/\bfita espanta passaros\b/.test(nome) && /^fitas?$/.test(categoria)) return 7137;
  if (/^feltros? autoadesivos?\b/.test(nome) && /^(?:colas?|outros)$/.test(categoria)) return 7214;
  if (/^capa (?:p\/chuva|de chuva)\b/.test(nome) && /^outros$/.test(categoria)) return 3066;
  if (/^jogo allen\b/.test(nome) && /^outros$/.test(categoria)) return 1439;
  if (/^suporte para fita lacradora\b/.test(nome) && /^fitas?$/.test(categoria)) return 503746;
  if (/^(?:massa de polir|kaol p\/polimento)\b/.test(nome) && /^(?:quimicos|outros)$/.test(categoria)) return 2590;
  if (/\bcera polidora\b/.test(nome) && /^(?:quimicos|outros)$/.test(categoria)) return 2643;
  if (/\bgrafite spray\b/.test(nome) && /^(?:grafite|quimicos|outros)$/.test(categoria)) return 1753;
  if (/\bcarga gas p\/macar\/fog\b/.test(nome) && /^eletrica$/.test(categoria)) return 543575;
  if (/\b(?:dual ring de pu|anel nbr\b|anel quadrado\b|kit anel (?:milimetro|milimitro|polegada)\b)/.test(nome) && /^(?:aneis|outros)$/.test(categoria)) return 111;
  if (/^cantoneira p\/mov over\b/.test(nome) && /^cantoneiras?$/.test(categoria)) return 632;
  if (/^assento\b.*\balumasa\b/.test(nome) && /^outros$/.test(categoria)) return 1865;
  if (/^tampa lavatorio\b/.test(nome) && /^hidraulica$/.test(categoria)) return 1963;
  if (/^tampa nbr\b.*\b47x7\b/.test(nome) && /^hidraulica$/.test(categoria)) return 111;
  if (/\bborracha esponjosa\b/.test(nome) && /^outros$/.test(categoria)) return 503744;
  if (/^teadit fita fibra de vidro\b/.test(nome) && /^(?:juntas|fitas)$/.test(categoria)) return 111;
  if (/^pregos?\b/.test(nome) && /^parafusos?$/.test(categoria)) return 2408;
  if (/^discos?$/.test(categoria) && /\bdisco\b.*(?:corte|lixa|inox|ceramica|vidro|ferro|alum|alvenaria|segmentado)/.test(nome)) return 499860;
  if (/^soquete\b/.test(nome) && /^soquetes?$/.test(categoria)) return /sextavado|magnetico/.test(nome) ? 5571 : 1869;
  if (/^tomada\b|^benjamin\b/.test(nome) && /^eletrica$/.test(categoria)) return 499966;
  if (/^interruptor\b/.test(nome) && /^eletrica$/.test(categoria)) return 1935;
  if (/^lanterna\b/.test(nome) && /^eletrica$/.test(categoria)) return 543689;
  if (/^ext(?:ensao|encao|\.)\s*(?:daneva|ilumi|preta|branca|sort)?\b/.test(nome) && /^eletrica$/.test(categoria)) return 4789;
  if (/^abracadeiras?$/.test(categoria) && /\b(?:borboleta|micro|rsf)\b/.test(nome)) return 2634;
  if (/^abracadeira 5\/8\b/.test(nome) && /^abracadeiras?$/.test(categoria)) return 502978;
  if (/^abracadeiras?$/.test(categoria) && /nylon.*enfocagato|enforca.?gato/.test(nome)) return 3764;
  if (/^guia 6325\b/.test(nome) && /^pinos?$/.test(categoria)) return 111;
  if (/^fita guia\b.*\bteflon\b/.test(nome) && /^fitas?$/.test(categoria)) return 111;
  if (/^pino 3 saida\b/.test(nome) && /^pinos?$/.test(categoria)) return 127;
  if (/^polia\b/.test(nome) && /^polias?$/.test(categoria)) return 111;
  if (/^rolmax\s+conj\./.test(nome) && /^conjuntos?$/.test(categoria)) return 111;
  if (/^junta\b/.test(nome) && /^juntas?$/.test(categoria) && !/^teadit\s+fita\b/.test(nome)) return 111;
  if (/^(?:papelao\b.*(?:velumoid|guarnital|teadit)|guarnital\b)/.test(nome) && /^juntas?$/.test(categoria)) return 111;
  if (/\bacoplamento\b/.test(nome) && /^acoplamentos?$/.test(categoria)) return 111;
  if (/\bemenda\b/.test(nome) && /^emendas?$/.test(categoria)) return /\b(?:cl|ansi)\s*\d|\basa\s*\d/i.test(nome) ? 111 : /mangueira/.test(nome) ? 1810 : undefined;
  if (/^cordao\b/.test(nome) && /^cordoes?$/.test(categoria)) return 111;
  if (/^anel backup\b|^anel v-ring\b|^selo mecanico\b|^junta espirometalica\b/.test(nome) && /^vedacoes?$/.test(categoria)) return 111;
  if (/\b(?:desengripante|graxa)\b/.test(nome) && /^(?:quimicos|outros)$/.test(categoria)) return 1753;
  if (/^mata-(?:formiga|barata)\b/.test(nome) && /^quimicos$/.test(categoria)) return 2869;
  if (/^tira grude\b/.test(nome) && /^quimicos$/.test(categoria)) return 503741;
  if (/^creo linhal\b/.test(nome) && /^quimicos$/.test(categoria)) return 2277;
  if (/^limpa geladeira\b/.test(nome) && /^quimicos$/.test(categoria)) return 4976;
  if (/\b(?:cola|adesivo|durepoxi|trava prisioneiro|massa epoxi)\b/.test(nome) && /^(?:colas?|quimicos|outros)$/.test(categoria)) return 503742;
  if (/^limpa contato\b/.test(nome) && /^outros$/.test(categoria)) return 4617;
  if (/\btomada\b/.test(nome) && /^outros$/.test(categoria)) return 499966;
  if (/^cabo bateria\b/.test(nome) && /^eletrica$/.test(categoria)) return 2345;
  if (/^sensor porta lamp\b/.test(nome) && /^eletrica$/.test(categoria)) return 6833;
  if (/^controle remoto universal\b/.test(nome) && /^eletrica$/.test(categoria)) return 341;
  if (/^controle vent\b/.test(nome) && /^eletrica$/.test(categoria)) return 127;
  if (/^resistencia\b.*\b(?:ducha|top jet)\b/.test(nome) && /^eletrica$/.test(categoria)) return 1744;
  if (/^ventilador coluna\b/.test(nome) && /^eletrica$/.test(categoria)) return 2535;
  if (/^ventilador parede\b/.test(nome) && /^eletrica$/.test(categoria)) return 8090;
  if (/^eletrodo\b/.test(nome) && /^eletrica$/.test(categoria)) return 1995;
  if (/^pilha rayovac\b/.test(nome) && /^eletrica$/.test(categoria)) return 4928;
  if (/^cabo extensor p\/pint\b/.test(nome) && /^eletrica$/.test(categoria)) return 503740;
  if (/^cabo [\"']?t[\"']? enc\b|^adaptador impacto\b/.test(nome) && /^eletrica$/.test(categoria)) return 5571;
  if (/\bmacaco garrafa\b/.test(nome) && /^outros$/.test(categoria)) return 503771;
  if (/\breparo motor\b.*\bdanfoss\b/.test(nome) && /^outros$/.test(categoria)) return 111;
  if (/^pastilha de freio\b/.test(nome) && /^outros$/.test(categoria)) return 2977;
  if (/^lona plast\b/.test(nome) && /^outros$/.test(categoria)) return 4988;
  if (/^bebedouro .*poleiro\b/.test(nome) && /^outros$/.test(categoria)) return 698;
  if (/^sifao\b/.test(nome) && /^hidraulica$/.test(categoria)) return 1319;
  if (/^anel pvc sifao\b/.test(nome) && /^hidraulica$/.test(categoria)) return 6732;
  if (/^(?:tubo ligacao|valvula lavatorio|valvula tanquinho|bico engate|esguicho|reducao simples hl)\b/.test(nome) && /^hidraulica$/.test(categoria)) return 1810;
  if (/^reducao (?:ol|simples asa|simples cl)\s*\d|^bomba manual de transferencia\b/.test(nome) && /^hidraulica$/.test(categoria)) return 111;
  if (/^retentor\b/.test(nome)) return 111;
  if (/^fita isolante\b/.test(nome) && /^isolantes?$/.test(categoria)) return 127;
  if (/^pino (?:macho|femea|porta lampada)\b/.test(nome) && /^pinos?$/.test(categoria)) return 127;
  if (/^extensao (?:enrolavel|\d+\s*m\b)/.test(nome) && /^extensoes?$/.test(categoria)) return 4789;
  const daCategoria = prateleira(nomeDaCategoria);
  return daCategoria !== undefined && LIMPEZA_DE_VEICULOS.has(daCategoria) ? itemDeLimpezaDeVeiculo(nome) ?? daCategoria : daCategoria;
}

/** As prateleiras de estética automotiva: só dentro delas o nome refina a família. */
const LIMPEZA_DE_VEICULOS = new Set([2590, 2643, 2894, 2895, 2789]);

/**
 * A categoria da loja agrupa por etapa do serviço ("Polimento", "Lavagem"),
 * o Google por natureza do item. Boina de polimento em "Polimento" caía em
 * "Soluções para limpeza de carro", que é líquido; limpador de vidro e de
 * estofado têm folha própria. Só roda com a categoria já resolvida para
 * limpeza de veículos, então "boina" de loja de roupa não chega aqui.
 * Recebe o nome já sem acento e em minúsculas.
 */
function itemDeLimpezaDeVeiculo(nome: string): number | undefined {
  // A taxonomia não tem folha para boina de politriz: o pai "Limpeza de
  // veículos" é o mais específico que não afirma coisa errada.
  if (/\b(?:boinas?|pads?)\b/.test(nome)) return 2895;
  if (/\b(?:escovas?|pinceis|pincel|aplicador(?:es)?|luvas?)\b/.test(nome)) return 2894;
  if (/\bsanitizante\b/.test(nome)) return 2590;
  if (/\b(?:aromatizantes?|arominha|odorizador(?:es)?)\b/.test(nome)) return 2789;
  if (/\b(?:estofados?|carpetes?)\b/.test(nome)) return 2704;
  if (/\bvidros?\b|\banti-?fog\b|\bmarcas d.agua\b/.test(nome)) return 2846;
  if (/\bshampoo\b/.test(nome)) return 2590;
  return undefined;
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
  const industrial = nomes.some((n) => !!n && SINAL_INDUSTRIAL.test(n));
  return (nomeDaCategoria) => {
    if (!nomeDaCategoria) return undefined;
    const direta = categoriaGoogle(nomeDaCategoria);
    if (direta !== undefined) return direta;
    if (automotiva) {
      const automotivaDireta = REGRAS_DO_RAMO.find((r) => r.termos.test(nomeDaCategoria))?.id;
      if (automotivaDireta !== undefined) return automotivaDireta;
    }
    if (industrial && CATEGORIAS_INDUSTRIAIS.test(nomeDaCategoria.trim())) return 111; // Categoria pai para famílias industriais confirmadas.
    return undefined;
  };
}
