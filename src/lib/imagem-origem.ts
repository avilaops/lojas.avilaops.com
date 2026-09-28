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

/**
 * As três origens como o painel as oferece.
 *
 * Mora junto do que a vitrine diz, e não numa lista dentro do formulário,
 * porque rótulo e aviso são a mesma declaração vista de dois lados: quem
 * escolhe "Foto da série" no painel precisa ler ali o que o comprador vai ler
 * no card. Duas listas divergiriam no primeiro ajuste de texto.
 */
export const ORIGENS_DE_IMAGEM = [
  { valor: "propria", rotulo: "Foto deste item", ajuda: "Do SKU exato: própria, ou do fabricante com o código conferido. A loja não diz nada." },
  { valor: "representativa", rotulo: "Foto da série", ajuda: "De outro item da mesma família visual. Exige dizer de que série veio, para achar quem usa a foto no dia em que ela for trocada." },
  { valor: "ilustracao", rotulo: "Ilustração técnica", ajuda: "Desenho gerado das medidas cadastradas. Não é fotografia, e a loja avisa." },
] as const;

/**
 * A declaração que vai ao banco, a partir do que o formulário tem na tela.
 *
 * Duas regras que não podem morar no JSX, porque são as mesmas que a escrita
 * aplica e que o `CHECK` do Postgres cobra:
 *
 *   sem foto, não há o que declarar — a origem volta a ser a própria;
 *   a família acompanha a foto de série e só ela. Deixada para trás depois de
 *   trocar para foto própria, a auditoria de "quem herdou esta imagem" passa
 *   a mentir, e é exatamente para ela que a coluna existe.
 */
export function declaracaoDaImagem(imagens: string[], origem: string, familia: string): { imagemOrigem: string; imagemFamilia: string | null } {
  if (imagens.length === 0) return { imagemOrigem: "propria", imagemFamilia: null };
  return {
    imagemOrigem: origem,
    imagemFamilia: origem === "representativa" ? familia.trim() || null : null,
  };
}
