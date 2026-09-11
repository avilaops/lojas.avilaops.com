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

/** A descrição da página: a curta, se o lojista escreveu; senão a longa resumida. */
export function descricaoDoProduto(p: { descricaoCurta?: string | null; descricao?: string | null }): string | undefined {
  return resumoParaMeta(p.descricaoCurta) ?? resumoParaMeta(p.descricao);
}
