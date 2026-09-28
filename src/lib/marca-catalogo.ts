/**
 * Conferência da marca declarada no catálogo.
 *
 * A vitrine publica `Produto.marca` como ela está no banco: o JSON-LD do
 * produto (`src/app/produtos/[slug]/page.tsx`) e o `g:brand` do feed
 * (`src/lib/catalogo-merchant.ts`) recebem esse texto sem passar por regra
 * nenhuma. Os dois acertam em omitir a marca quando ela é nula — o defeito
 * nunca esteve neles, está no dado. Marca errada ali é afirmação sobre
 * fabricante de terceiro, e no Merchant Center diverge da embalagem e do
 * GTIN: motivo de reprovação de ficha.
 *
 * Uma coisa só se prova sem sair do catálogo: quando o nome do produto cita
 * uma marca que a própria loja usa em outros produtos, e essa marca não é a
 * declarada, o cadastro se contradiz sozinho. É o que `divergente` marca.
 *
 * O que NÃO se prova daqui é qual é a marca certa de um produto cujo nome não
 * a diz — essa evidência está na embalagem, na foto, fora do banco. Esses
 * casos saem como `sem-evidencia`, e nada aqui os corrige sozinho: marca
 * inventada é exatamente o defeito que este módulo existe para conter.
 *
 * O GTIN não serve de prova: fabricante que registra várias marcas usa o
 * mesmo prefixo GS1 em todas elas, então o prefixo separa empresa, não marca.
 *
 * O vocabulário de marcas vem do catálogo da própria loja, nunca de lista
 * escrita aqui — loja é dado, não código.
 */

export type ProdutoComMarca = { nome: string; marca: string | null };

export type SituacaoMarca =
  /** Sem marca declarada. A vitrine omite `brand`; não há o que conferir. */
  | "sem-marca"
  /** O nome cita a mesma marca declarada. */
  | "confirmada"
  /** O nome cita outra marca do catálogo. O cadastro se contradiz. */
  | "divergente"
  /** Nada no registro prova a marca declarada. Conferir pela embalagem. */
  | "sem-evidencia";

export type ConferenciaMarca = {
  situacao: SituacaoMarca;
  /** A marca que o nome cita, quando cita uma só. */
  marcaCitada: string | null;
};

/** Minúsculas, sem acento, só letras e números separados por espaço. */
export function normalizarParaMarca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** As marcas que esta loja usa, na grafia em que as cadastrou. */
export function vocabularioDeMarcas(produtos: readonly ProdutoComMarca[]): string[] {
  const porForma = new Map<string, string>();
  for (const p of produtos) {
    const marca = p.marca?.trim();
    if (!marca) continue;
    const forma = normalizarParaMarca(marca);
    if (forma && !porForma.has(forma)) porForma.set(forma, marca);
  }
  return [...porForma.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * A marca que o nome cita, se cita uma só.
 *
 * Casa palavra inteira: "Boina Micro Wolf" não cita "Wolf Pads". Quando duas
 * marcas casam e uma contém a outra, vale a mais longa ("Vintex Pro" sobre
 * "Vintex"); quando casam duas marcas independentes, o nome é ambíguo e não
 * prova nada.
 */
export function marcaCitadaNoNome(nome: string, vocabulario: readonly string[]): string | null {
  const alvo = ` ${normalizarParaMarca(nome)} `;
  const casaram = vocabulario.filter((m) => {
    const forma = normalizarParaMarca(m);
    return forma.length > 0 && alvo.includes(` ${forma} `);
  });
  const maisLongas = casaram.filter((m) => {
    const forma = ` ${normalizarParaMarca(m)} `;
    return !casaram.some((o) => o !== m && ` ${normalizarParaMarca(o)} `.includes(forma));
  });
  return maisLongas.length === 1 ? maisLongas[0] : null;
}

export function conferirMarca(
  produto: ProdutoComMarca,
  vocabulario: readonly string[],
): ConferenciaMarca {
  const marcaCitada = marcaCitadaNoNome(produto.nome, vocabulario);
  const declarada = produto.marca?.trim();
  if (!declarada) return { situacao: "sem-marca", marcaCitada };
  if (!marcaCitada) return { situacao: "sem-evidencia", marcaCitada: null };
  const igual = normalizarParaMarca(marcaCitada) === normalizarParaMarca(declarada);
  return { situacao: igual ? "confirmada" : "divergente", marcaCitada };
}

export type LinhaConferida<T extends ProdutoComMarca> = T & ConferenciaMarca;

/**
 * Confere o catálogo inteiro contra o vocabulário que ele mesmo define.
 * Uma loja com uma marca só não tem com que se contradizer, e é isso que o
 * resultado mostra: tudo confirmado ou sem evidência, nunca divergente.
 */
export function conferirCatalogo<T extends ProdutoComMarca>(
  produtos: readonly T[],
): {
  vocabulario: string[];
  linhas: LinhaConferida<T>[];
  divergentes: LinhaConferida<T>[];
  semEvidencia: LinhaConferida<T>[];
  confirmadas: LinhaConferida<T>[];
  semMarca: LinhaConferida<T>[];
} {
  const vocabulario = vocabularioDeMarcas(produtos);
  const linhas = produtos.map((p) => ({ ...p, ...conferirMarca(p, vocabulario) }));
  const por = (s: SituacaoMarca) => linhas.filter((l) => l.situacao === s);
  return {
    vocabulario,
    linhas,
    divergentes: por("divergente"),
    semEvidencia: por("sem-evidencia"),
    confirmadas: por("confirmada"),
    semMarca: por("sem-marca"),
  };
}
