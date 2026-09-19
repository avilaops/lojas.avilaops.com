/**
 * O que a vitrine diz quando a imagem não é do próprio item.
 *
 * `Produto.imagemOrigem` declara de que a foto é (ver `docs/VEDASHOW-FOTOS.md`
 * e a trava de `imagemFamilia`, que é CHECK no banco). Reaproveitar foto em
 * catálogo técnico é honesto — todo rolamento 6200 se parece —, fingir que ela
 * é do SKU exato não é.
 *
 * O texto mora aqui, e não no JSX, porque a mesma declaração precisa aparecer
 * em dois lugares com espaços muito diferentes: a galeria da página, que cabe
 * a frase inteira, e o card da vitrine, que cabe duas palavras. Eram duas
 * cópias divergentes (a galeria premium já dizia outra coisa), e uma cópia que
 * esquece de avisar é exatamente o erro que a política existe para impedir.
 *
 * O aviso do card importa mais que o da página, não menos: a grade é onde a
 * foto de série se repete dez vezes seguidas, e é ali que a pessoa decide
 * clicar — depois do clique ela já está lendo a ficha.
 */

/** A frase inteira, para onde há espaço: a galeria da página do produto. */
export const AVISO_IMAGEM: Record<string, string> = {
  representativa: "Imagem representativa da série. Confira as medidas e especificações deste produto.",
  ilustracao: "Ilustração técnica gerada a partir das medidas cadastradas, não é foto do produto.",
};

/** Duas palavras, para onde não há: o selo sobre a foto no card. */
export const SELO_IMAGEM: Record<string, string> = {
  representativa: "Foto da série",
  ilustracao: "Ilustração",
};

/**
 * Sem imagem não há aviso: a vitrine já diz "Imagem em preparação", e declarar
 * a origem de uma foto que não existe é ruído. É também o que a trava do banco
 * recusa na escrita — aqui é a mesma regra do lado de quem lê.
 */
export function avisoDaImagem(origem: string | null | undefined, temImagem: boolean): string | null {
  return temImagem && origem ? (AVISO_IMAGEM[origem] ?? null) : null;
}

/** O selo curto do card, pela mesma regra do aviso. */
export function seloDaImagem(origem: string | null | undefined, temImagem: boolean): string | null {
  return temImagem && origem ? (SELO_IMAGEM[origem] ?? null) : null;
}
