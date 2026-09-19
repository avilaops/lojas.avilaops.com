/**
 * A mensagem que um formulário do painel mostra quando a gravação é recusada.
 *
 * As rotas respondem `{ erro, detalhes: { fieldErrors } }` — o `erro` é o
 * título ("Dados inválidos.") e `fieldErrors` diz o que recusou. Só o título
 * chegava à tela, e num formulário de trinta campos "Dados inválidos." é beco
 * sem saída: a pessoa não tem como saber se foi a foto, o GTIN ou o preço.
 *
 * Os nomes saem como o schema os chama, de propósito: é o que permite procurar
 * o campo. No máximo três, para o aviso não virar um parágrafo.
 */
export interface RespostaDeErro {
  erro?: string;
  detalhes?: { fieldErrors?: Record<string, string[] | undefined> };
}

export function detalharErro(d: RespostaDeErro | null | undefined, padrao = "Falha ao salvar."): string {
  const base = d?.erro ?? padrao;
  const campos = Object.entries(d?.detalhes?.fieldErrors ?? {})
    .map(([campo, msgs]) => (msgs?.length ? `${campo}: ${msgs[0]}` : null))
    .filter((x): x is string => x !== null);
  if (campos.length === 0) return base;
  const mostrados = campos.slice(0, 3).join(" · ");
  return `${base} ${mostrados}${campos.length > 3 ? ` (e mais ${campos.length - 3})` : ""}`;
}
