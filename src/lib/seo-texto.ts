/**
 * Texto de cadastro virando meta description.
 *
 * A página de produto usava só `descricaoCurta`, e quem importa catálogo de
 * outro sistema quase nunca traz esse campo: a Brilhax chegou com 224 produtos
 * e nenhum com descrição curta, então nenhuma página de produto tinha meta
 * description, enquanto o site antigo tinha em todas. O Google então escolhe
 * um trecho qualquer da página para o resultado de busca.
 *
 * Aqui a descrição completa vira a meta: sem HTML, sem espaço duplicado, e
 * cortada em fim de palavra, perto do tamanho que o Google mostra.
 */

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&#47;": "/",
};

/** Texto puro, numa linha só. */
export function textoPuro(entrada: string | null | undefined): string {
  return (entrada ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resume para caber na meta description.
 *
 * 155 caracteres é o que o resultado do Google costuma mostrar em desktop.
 * Corta no último espaço antes do limite, para não entregar "limpador ácido
 * automot…", e só põe reticências quando de fato cortou.
 */
export function resumoParaMeta(entrada: string | null | undefined, limite = 155): string | undefined {
  const texto = textoPuro(entrada);
  if (!texto) return undefined;
  if (texto.length <= limite) return texto;

  const corte = texto.slice(0, limite - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  // Palavra única enorme (código, URL): corta seco em vez de devolver vazio.
  const base = ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte;
  return `${base.replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Complementa textos curtos com orientação, sem inventar atributos ou ofertas. */
export function complementarDescricaoMeta(entrada: string, complemento: string): string {
  const base = textoPuro(entrada);
  if (base.length >= 150) return resumoParaMeta(base)!;
  const frase = base && !/[.!?…]$/.test(base) ? `${base}.` : base;
  return resumoParaMeta(`${frase} ${complemento}`)!;
}

/** Preserva a descrição cadastrada e acrescenta contexto da loja quando necessário. */
export function descricaoDoProduto(p: { nome?: string; descricaoCurta?: string | null; descricao?: string | null }, loja?: string): string | undefined {
  const descricao = resumoParaMeta(p.descricaoCurta) ?? resumoParaMeta(p.descricao);
  if (!loja) return descricao;
  const base = descricao ?? textoPuro(p.nome);
  if (!base) return undefined;
  return complementarDescricaoMeta(base, `Consulte as características e a disponibilidade na ${textoPuro(loja)}. Confirme os detalhes do produto e as condições de compra antes de escolher.`);
}

/** A home apresenta a loja; a listagem identifica o catálogo que o visitante abriu. */
export function descricaoDoCatalogo(nome: string, apresentacao: string, pagina: "inicio" | "catalogo"): string {
  const loja = textoPuro(nome);
  const base = pagina === "inicio" ? textoPuro(apresentacao) : `Catálogo de produtos da ${loja}. ${textoPuro(apresentacao)}`;
  return complementarDescricaoMeta(base, `Explore os produtos da ${loja}, confira suas características e disponibilidade e consulte as condições de compra e os canais de atendimento da loja.`);
}
