/**
 * Farmácia e drogaria: o que separa esta loja de uma loja de cosméticos que
 * por acaso vende dipirona.
 *
 * Três coisas, e nenhuma delas é visual:
 *
 *   1. **Tarja.** No Brasil um medicamento pertence a uma faixa, e a faixa
 *      decide o que a loja pode fazer com ele. Isento de prescrição (MIP)
 *      vende como qualquer produto. Tarja vermelha exige receita, mas pode ser
 *      dispensado a distância. Tarja vermelha com retenção e tarja preta são
 *      substâncias sob controle especial da Portaria SVS/MS 344/98: a venda
 *      pela internet é **proibida** (RDC 44/2009, art. 62), e a loja que põe
 *      "comprar" ao lado deles não está com um bug de vitrine, está cometendo
 *      infração sanitária. Por isso a regra mora aqui, no dado, e não no bom
 *      senso de quem cadastra.
 *
 *   2. **Princípio ativo.** Quem procura remédio procura pelo que o médico
 *      escreveu, que tanto pode ser a marca ("Novalgina") quanto a molécula
 *      ("dipirona monoidratada"). E o genérico do mesmo princípio, na mesma
 *      dose e apresentação, é intercambiável por lei (Lei 9.787/99): mostrar
 *      os equivalentes lado a lado não é venda cruzada, é o direito do
 *      comprador de pagar menos pelo mesmo tratamento. É o análogo exato da
 *      compatibilidade de motopeças: "o que serve no lugar deste".
 *
 *   3. **Responsável técnico.** Farmácia virtual só existe legalmente com
 *      farmacêutico responsável identificado, CRF visível e licença sanitária
 *      declarada (RDC 44/2009, art. 55). Isso é campo do tenant e vai para o
 *      rodapé sozinho, pelo mesmo motivo que o CNPJ já vai: não pode depender
 *      de o lojista lembrar de escrever numa página solta.
 *
 * Tudo aqui é puro (sem Prisma, sem React, sem cookie) para servir ao
 * servidor, ao card, ao painel e ao teste. Quem lê do banco é quem chama.
 */

/**
 * A faixa do medicamento, que é o que manda no que a vitrine pode oferecer.
 *
 *   nenhuma            não é medicamento: dermocosmético, higiene, fralda,
 *                      suplemento alimentar. A maioria do catálogo de uma
 *                      drogaria. Vende como qualquer produto.
 *   livre              MIP, medicamento isento de prescrição. Vende normal,
 *                      mas carrega o aviso legal obrigatório.
 *   vermelha           "Venda sob prescrição médica". Vendável a distância;
 *                      a receita é exigida na entrega.
 *   vermelha-retencao  "Venda sob prescrição médica com retenção de receita".
 *                      Controle especial: venda remota proibida.
 *   preta              Psicotrópico ou entorpecente (A1/A2/A3/B1/B2).
 *                      Controle especial: venda remota proibida.
 */
export type Tarja = "nenhuma" | "livre" | "vermelha" | "vermelha-retencao" | "preta";

export const TARJAS: ReadonlyArray<readonly [Tarja, string]> = [
  ["nenhuma", "Não é medicamento"],
  ["livre", "Isento de prescrição (MIP)"],
  ["vermelha", "Tarja vermelha — sob prescrição"],
  ["vermelha-retencao", "Tarja vermelha com retenção de receita"],
  ["preta", "Tarja preta — controle especial"],
] as const;

/**
 * O que o medicamento é perante o de referência. Não é enfeite de ficha: é
 * o que permite dizer "este é o genérico daquele" com a segurança da
 * Lei 9.787/99, que só reconhece intercambialidade do genérico.
 *
 *   referencia   a marca original, registrada e com eficácia comprovada
 *   generico     mesma molécula, dose e forma; intercambiável por lei
 *   similar      mesma molécula, com nome de fantasia próprio
 *   novo         registro próprio, sem genérico equivalente
 *   fitoterapico derivado vegetal com registro próprio
 *   manipulado   preparado na farmácia sob fórmula
 */
export type TipoMedicamento = "referencia" | "generico" | "similar" | "novo" | "fitoterapico" | "manipulado";

export const TIPOS_MEDICAMENTO: ReadonlyArray<readonly [TipoMedicamento, string]> = [
  ["referencia", "Referência (marca original)"],
  ["generico", "Genérico"],
  ["similar", "Similar"],
  ["novo", "Novo / sem genérico"],
  ["fitoterapico", "Fitoterápico"],
  ["manipulado", "Manipulado"],
] as const;

/** Os dados farmacêuticos de um produto, já normalizados. */
export interface Medicamento {
  tarja: Tarja;
  principioAtivo: string | null;
  apresentacao: string | null;
  registroAnvisa: string | null;
  tipo: TipoMedicamento | null;
}

/** O que a vitrine lê de um produto do banco. Só os campos que importam aqui. */
export interface ProdutoFarmaceutico {
  tarja?: string | null;
  principioAtivo?: string | null;
  apresentacao?: string | null;
  registroAnvisa?: string | null;
  tipoMedicamento?: string | null;
}

const TARJAS_VALIDAS = new Set<string>(TARJAS.map(([v]) => v));
const TIPOS_VALIDOS = new Set<string>(TIPOS_MEDICAMENTO.map(([v]) => v));

/**
 * Lê a tarja de um valor qualquer vindo do banco ou de uma importação de ERP.
 * Desconhecido vira `nenhuma` — que é o único padrão seguro: a tarja restringe
 * a venda, então errar para o lado permissivo por causa de um typo no CSV
 * seria exatamente o risco que este módulo existe para evitar... mas errar
 * para o lado restritivo bloquearia a venda de sabonete. A saída é que
 * `nenhuma` não libera nada que já não estivesse liberado: quem cadastra
 * medicamento declara a faixa, e o painel cobra isso (ver `pendenciasDe`).
 */
export function lerTarja(bruto: unknown): Tarja {
  const v = typeof bruto === "string" ? bruto.trim().toLowerCase() : "";
  return TARJAS_VALIDAS.has(v) ? (v as Tarja) : "nenhuma";
}

export function lerTipoMedicamento(bruto: unknown): TipoMedicamento | null {
  const v = typeof bruto === "string" ? bruto.trim().toLowerCase() : "";
  return TIPOS_VALIDOS.has(v) ? (v as TipoMedicamento) : null;
}

const texto = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};

/** Os dados farmacêuticos do produto, normalizados. Sempre devolve um objeto. */
export function lerMedicamento(p: ProdutoFarmaceutico): Medicamento {
  return {
    tarja: lerTarja(p.tarja),
    principioAtivo: texto(p.principioAtivo),
    apresentacao: texto(p.apresentacao),
    registroAnvisa: texto(p.registroAnvisa),
    tipo: lerTipoMedicamento(p.tipoMedicamento),
  };
}

/** É medicamento? Fralda e shampoo não são, e não carregam nada disto. */
export function ehMedicamento(m: Medicamento): boolean {
  return m.tarja !== "nenhuma" || m.principioAtivo != null || m.registroAnvisa != null;
}

/** Precisa de receita para ser dispensado. */
export function exigeReceita(tarja: Tarja): boolean {
  return tarja === "vermelha" || tarja === "vermelha-retencao" || tarja === "preta";
}

/** A receita fica retida na farmácia (controle especial). */
export function exigeRetencao(tarja: Tarja): boolean {
  return tarja === "vermelha-retencao" || tarja === "preta";
}

/**
 * Não pode ser vendido pela internet.
 *
 * RDC 44/2009, art. 62: é vedado o comércio eletrônico de medicamentos sujeitos
 * a controle especial (Portaria SVS/MS 344/98), que são exatamente os de tarja
 * preta e os de tarja vermelha com retenção de receita.
 *
 * A vitrine continua mostrando o produto — quem procura clonazepam tem que
 * achar a página, ver o preço e saber que a loja tem —, mas o botão de comprar
 * dá lugar ao caminho presencial. É a diferença entre "a loja não tem" e "a lei
 * não deixa comprar daqui".
 */
export function vendaRemotaProibida(tarja: Tarja): boolean {
  return exigeRetencao(tarja);
}

export function rotuloTarja(tarja: Tarja): string {
  return TARJAS.find(([v]) => v === tarja)?.[1] ?? "Não é medicamento";
}

export function rotuloTipo(tipo: TipoMedicamento | null): string | null {
  return tipo ? (TIPOS_MEDICAMENTO.find(([v]) => v === tipo)?.[1] ?? null) : null;
}

/**
 * A frase que a página do produto precisa mostrar, por faixa. Curta, na voz da
 * norma, sem adjetivo de marketing: é aviso legal, não copy.
 */
export function avisoDaTarja(tarja: Tarja): string | null {
  switch (tarja) {
    case "livre":
      return "Medicamento isento de prescrição. Leia a bula. Se persistirem os sintomas, o médico deverá ser consultado.";
    case "vermelha":
      return "Venda sob prescrição médica. A receita será solicitada no momento da entrega.";
    case "vermelha-retencao":
      return "Venda sob prescrição médica com retenção de receita. Medicamento sob controle especial: a venda pela internet é proibida (RDC 44/2009). Procure a loja presencialmente.";
    case "preta":
      return "Medicamento sob controle especial (Portaria 344/98). A venda pela internet é proibida (RDC 44/2009). Procure a loja presencialmente.";
    default:
      return null;
  }
}

/**
 * O aviso obrigatório em qualquer peça de medicamento (Lei 9.294/96 e
 * RDC 96/2008). Vai no rodapé da loja de farmácia, uma vez, em caixa alta,
 * como a norma pede.
 */
export const AVISO_MEDICAMENTO =
  "SE PERSISTIREM OS SINTOMAS, O MÉDICO DEVERÁ SER CONSULTADO. MEDICAMENTOS PODEM CAUSAR EFEITOS INDESEJADOS. LEIA A BULA.";

/**
 * Chave de comparação de princípio ativo: minúsculas, sem acento, sem
 * pontuação, com os sinônimos de sal colapsados.
 *
 * "Dipirona Monoidratada", "dipirona monoidratada" e "DIPIRONA MONO-HIDRATADA"
 * são o mesmo princípio escrito por três ERPs diferentes. Sem isso, a loja
 * mostraria o genérico ao lado do de referência só quando o cadastro batesse
 * letra por letra, que é quase nunca.
 */
export function chaveDoPrincipio(bruto: string | null | undefined): string {
  if (!bruto) return "";
  return bruto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\bmono\s?hidratada?\b/g, "monoidratada")
    .replace(/\bcloridrato de\b/g, "cloridrato")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesmo princípio ativo, escrito de jeitos diferentes. */
export function mesmoPrincipio(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = chaveDoPrincipio(a);
  return ka !== "" && ka === chaveDoPrincipio(b);
}

/**
 * Chave da apresentação: "500 mg", "500mg" e "500 MG" são a mesma dose.
 *
 * Só compara o que está escrito; não tenta converter g em mg nem interpretar
 * "1 caixa com 20". Genérico equivalente exige mesma dose E mesma forma, e na
 * dúvida é melhor não sugerir do que sugerir a dose errada.
 */
export function chaveDaApresentacao(bruto: string | null | undefined): string {
  if (!bruto) return "";
  return bruto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/(\d)\s+(mg|g|ml|mcg|ui|%)\b/g, "$1$2")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Este produto é intercambiável com aquele?
 *
 * Mesmo princípio ativo e mesma apresentação. A Lei 9.787/99 só reconhece
 * intercambialidade do genérico com o de referência, então o similar entra na
 * lista como "mesma substância" e a tela diz isso com todas as letras em vez
 * de chamá-lo de equivalente.
 */
export function equivalentes<T extends ProdutoFarmaceutico>(alvo: ProdutoFarmaceutico, candidatos: T[]): T[] {
  const m = lerMedicamento(alvo);
  if (!m.principioAtivo) return [];
  const apresentacao = chaveDaApresentacao(m.apresentacao);
  return candidatos.filter((c) => {
    const cm = lerMedicamento(c);
    if (!mesmoPrincipio(m.principioAtivo, cm.principioAtivo)) return false;
    // Sem apresentação cadastrada dos dois lados não dá para afirmar que a dose
    // é a mesma; entra assim mesmo, porque o comprador ainda quer ver a opção,
    // e a tela mostra a apresentação de cada um para ele conferir.
    if (!apresentacao || !chaveDaApresentacao(cm.apresentacao)) return true;
    return chaveDaApresentacao(cm.apresentacao) === apresentacao;
  });
}

/** Quanto se economiza trocando por este. Null quando não há o que comparar. */
export function economia(precoAtualCentavos: number, precoAlternativoCentavos: number): number | null {
  if (precoAtualCentavos <= 0 || precoAlternativoCentavos <= 0) return null;
  if (precoAlternativoCentavos >= precoAtualCentavos) return null;
  return Math.round(((precoAtualCentavos - precoAlternativoCentavos) / precoAtualCentavos) * 100);
}

/**
 * O que falta no cadastro para este item poder ser vendido como medicamento.
 *
 * Serve ao painel, não à vitrine: é a lista que aparece para o lojista antes de
 * ele publicar. Medicamento sem registro na Anvisa e sem princípio ativo é
 * cadastro incompleto, e quem vai descobrir isso não pode ser o fiscal.
 */
export function pendenciasDe(p: ProdutoFarmaceutico): string[] {
  const m = lerMedicamento(p);
  if (!ehMedicamento(m)) return [];
  const faltando: string[] = [];
  if (m.tarja === "nenhuma") faltando.push("Informe a tarja: é ela que decide se o item pode ser vendido pela internet.");
  if (!m.principioAtivo) faltando.push("Informe o princípio ativo, para o item aparecer na busca por substância e ao lado dos equivalentes.");
  if (!m.registroAnvisa) faltando.push("Informe o registro na Anvisa (13 dígitos), exigido para medicamento anunciado na internet.");
  if (!m.apresentacao) faltando.push("Informe a apresentação (dose e quantidade), sem a qual não dá para afirmar que um genérico equivale a este.");
  return faltando;
}

/**
 * Registro de medicamento na Anvisa: 13 dígitos, agrupados 1-4-4-3-1
 * (1.0298.0123.001-5 é o formato impresso na caixa). O cadastro costuma vir
 * com pontos; aqui só se confere a forma, não o dígito verificador, porque a
 * regra dele não é pública e rejeitar um registro válido seria pior do que
 * aceitar um digitado errado.
 */
export function registroAnvisaValido(bruto: string | null | undefined): boolean {
  if (!bruto) return false;
  return /^\d{13}$/.test(bruto.replace(/\D/g, ""));
}

/** "1.0298.0123.001-5" — como aparece na caixa. */
export function formatarRegistroAnvisa(bruto: string | null | undefined): string | null {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (d.length !== 13) return texto(bruto);
  return `${d[0]}.${d.slice(1, 5)}.${d.slice(5, 9)}.${d.slice(9, 12)}-${d[12]}`;
}

/**
 * Departamentos de uma drogaria, na ordem em que o comprador procura.
 *
 * Serve de semente ao criar a loja e de autocomplete no painel. Não é uma
 * amarra: a loja cadastra o que quiser, como em qualquer outro segmento.
 */
export const CATEGORIAS_FARMACIA: ReadonlyArray<{ nome: string; descricao: string }> = [
  { nome: "Medicamentos", descricao: "Genéricos, similares e de referência." },
  { nome: "Dermocosméticos", descricao: "Cuidado com a pele e o cabelo, com indicação." },
  { nome: "Vitaminas e suplementos", descricao: "Vitaminas, minerais e suplementação." },
  { nome: "Mamãe e bebê", descricao: "Fraldas, fórmulas e cuidado infantil." },
  { nome: "Higiene pessoal", descricao: "Banho, higiene bucal e cuidado diário." },
  { nome: "Saúde e bem-estar", descricao: "Aferição, primeiros socorros e ortopedia." },
];

/**
 * Princípios ativos mais dispensados no Brasil, para o autocomplete do painel.
 *
 * Existe pelo mesmo motivo que `MOTOS_BRASIL` existe: quem cadastra digita o
 * nome da molécula de memória, e um cadastro escrito de três jeitos quebra a
 * busca por substância e a lista de equivalentes. O que a loja cadastrar fora
 * desta lista continua valendo — ela é sugestão, não validação.
 */
export const PRINCIPIOS_COMUNS: readonly string[] = [
  "Ácido acetilsalicílico", "Amoxicilina", "Atenolol", "Atorvastatina", "Azitromicina",
  "Bromoprida", "Budesonida", "Captopril", "Cetirizina", "Cloridrato de metformina",
  "Dexametasona", "Diclofenaco sódico", "Dipirona monoidratada", "Enalapril", "Escitalopram",
  "Espironolactona", "Fluconazol", "Furosemida", "Hidroclorotiazida", "Ibuprofeno",
  "Levotiroxina sódica", "Loratadina", "Losartana potássica", "Meloxicam", "Metformina",
  "Metronidazol", "Nimesulida", "Omeprazol", "Paracetamol", "Pantoprazol",
  "Prednisona", "Rosuvastatina", "Sertralina", "Sinvastatina", "Sulfametoxazol + trimetoprima",
] as const;

/**
 * Sintomas e necessidades, com o termo que a busca da loja entende.
 *
 * É a porta de entrada da home de farmácia, e o análogo da garagem de
 * motopeças: o comprador não sabe o nome da molécula, sabe o que está sentindo.
 * Cada atalho é só uma busca pronta — não inventa categoria, não exige
 * cadastro, e some da tela se a loja não tiver nada que responda a ele.
 */
export const NECESSIDADES: ReadonlyArray<{ rotulo: string; termo: string }> = [
  { rotulo: "Dor e febre", termo: "analgesico" },
  { rotulo: "Gripe e resfriado", termo: "gripe" },
  { rotulo: "Alergia", termo: "antialergico" },
  { rotulo: "Estômago", termo: "antiacido" },
  { rotulo: "Vitaminas", termo: "vitamina" },
  { rotulo: "Pele", termo: "dermo" },
];

/**
 * Responsável técnico da farmácia (RDC 44/2009, art. 55). Vive no tenant e
 * aparece no rodapé de toda página da loja.
 */
export interface ResponsavelTecnico {
  nome: string | null;
  crf: string | null;
  licencaSanitaria: string | null;
  autorizacaoAnvisa: string | null;
}

export function lerResponsavel(t: {
  farmaceuticoResponsavel?: string | null;
  farmaceuticoCrf?: string | null;
  licencaSanitaria?: string | null;
  autorizacaoAnvisa?: string | null;
}): ResponsavelTecnico {
  return {
    nome: texto(t.farmaceuticoResponsavel),
    crf: texto(t.farmaceuticoCrf),
    licencaSanitaria: texto(t.licencaSanitaria),
    autorizacaoAnvisa: texto(t.autorizacaoAnvisa),
  };
}

/** Tem o mínimo para se identificar como farmácia: nome e CRF do farmacêutico. */
export function responsavelCompleto(r: ResponsavelTecnico): boolean {
  return r.nome != null && r.crf != null;
}
