import type { Produto } from "@prisma/client";
import { prisma } from "./db";
import { detalheDaCategoria, preverCategoria, type DetalheCategoria } from "./mercadolivre";
import {
  casaComOProduto,
  detalheComCache,
  ehCategoriaCoringa,
  prepararComCategoria,
  type CategoriaSugerida,
  type Preparo,
} from "./mercadolivre-preparo";

/**
 * Escolha manual da categoria do Mercado Livre.
 *
 * Existe porque o preparo mandava o lojista fazer algo que a plataforma não
 * oferecia: *"escolha a categoria do Mercado Livre à mão"* era a pendência de
 * todo produto cujo nome o preditor não entendeu, e não havia tela nenhuma
 * para isso. A cobrança existia; o caminho, não.
 *
 * **Nada aqui exige conta conectada.** Busca, detalhe e atributos de categoria
 * são endpoints públicos do ML, e obrigar o lojista a autorizar uma integração
 * de venda só para organizar o catálogo seria cobrar OAuth por trabalho que o
 * Mercado Livre entrega de graça. Ele arruma tudo antes, conecta depois.
 */

export interface CategoriaEncontrada {
  categoriaId: string;
  categoriaNome: string;
  /** Do topo até ela. É o que distingue os três "Rolamentos" do site. */
  caminho: string[];
  /** O ML só aceita anúncio em categoria folha. */
  folha: boolean;
  filhas: Array<{ categoriaId: string; categoriaNome: string }>;
}

const paraEncontrada = (d: DetalheCategoria): CategoriaEncontrada => ({
  categoriaId: d.categoriaId,
  categoriaNome: d.categoriaNome,
  caminho: d.caminho,
  folha: d.folha,
  filhas: d.filhas,
});

/**
 * Busca de categoria pelo que o lojista digita.
 *
 * O buscador é o mesmo preditor que o preparo usa, e de propósito: é ele que
 * responde por **texto livre**, que é como uma pessoa procura ("correia
 * dentada", "papelão hidráulico"). O ML não publica um índice de categorias
 * por palavra.
 *
 * A diferença está no coringa. No preparo, *Águas Minerais* em primeiro lugar
 * significa que o preditor não entendeu o nome, e por isso ele é sempre
 * descartado. Aqui, quem digitou foi uma pessoa: se ela escrever "água
 * mineral", a categoria de água mineral é a resposta certa e some-la seria
 * esconder justamente o que ela procurou. Então o coringa só cai quando não
 * casa com o texto digitado.
 */
export async function buscarCategorias(texto: string, limite = 8): Promise<CategoriaEncontrada[]> {
  const termo = texto.trim();
  if (termo.length < 3) return [];

  const cruas = (await preverCategoria(termo, limite)).map((c) => ({
    categoriaId: c.category_id,
    categoriaNome: c.category_name,
    dominioNome: c.domain_name,
  }));

  const uteis = cruas.filter((c) => !ehCategoriaCoringa(c.categoriaId) || casaComOProduto(termo, c));
  if (!uteis.length) return [];

  // O caminho vem de uma chamada por categoria, em paralelo: sem ele a lista é
  // uma fileira de nomes soltos, e escolher entre dois "Rolamentos" vira sorte.
  const detalhes = await Promise.all(uteis.map((c) => detalheComCache(c.categoriaId).catch(() => null)));
  return detalhes.filter((d): d is DetalheCategoria => Boolean(d)).map(paraEncontrada);
}

/** Uma categoria pelo id, para navegar pelas filhas até chegar numa folha. */
export async function detalharCategoria(categoriaId: string): Promise<CategoriaEncontrada | null> {
  const d = await detalheDaCategoria(categoriaId);
  return d ? paraEncontrada(d) : null;
}

export class CategoriaInvalida extends Error {}

/**
 * Recalcula o preparo do produto na categoria escolhida.
 *
 * Recusa **antes** de qualquer gravação, e é isso que protege a escolha
 * anterior: categoria inexistente, id malformado ou Mercado Livre fora do ar
 * levantam erro aqui, com o banco intacto. Um "salvar" que falha pela metade
 * apagaria a categoria que já estava certa.
 *
 * Categoria de meio de árvore é recusada com as filhas no erro: o ML só
 * publica em folha, e devolve a recusa sem dizer o que fazer. Aqui o lojista lê
 * para onde descer.
 */
export async function preparoNaCategoria(
  produto: ProdutoParaEscolha,
  categoriaId: string,
  grupo?: string | null,
): Promise<{ preparo: Preparo; categoria: CategoriaEncontrada }> {
  if (!/^MLB\d+$/.test(categoriaId)) {
    throw new CategoriaInvalida("Código de categoria fora do padrão do Mercado Livre.");
  }

  const detalhe = await detalheDaCategoria(categoriaId);
  if (!detalhe) throw new CategoriaInvalida("O Mercado Livre não reconhece essa categoria.");
  if (!detalhe.folha) {
    const primeiras = detalhe.filhas.slice(0, 3).map((f) => f.categoriaNome).join(", ");
    throw new CategoriaInvalida(
      `"${detalhe.categoriaNome}" agrupa outras categorias e o Mercado Livre não publica nela. Escolha uma dentro: ${primeiras}…`,
    );
  }

  const categoria: CategoriaSugerida = {
    categoriaId: detalhe.categoriaId,
    categoriaNome: detalhe.categoriaNome,
    dominioNome: detalhe.caminho.at(-2) ?? detalhe.categoriaNome,
    caminho: detalhe.caminho,
  };

  return { preparo: await prepararComCategoria({ produto, categoria, grupo }), categoria: paraEncontrada(detalhe) };
}

export type ProdutoParaEscolha = Pick<Produto, "id" | "nome" | "marca" | "sku" | "gtin" | "atributos">;

/**
 * O acesso ao banco, isolado para o teste poder trocá-lo.
 *
 * `acharProduto` recebe o tenant e o produto **juntos**: é a assinatura que
 * impede a loja A de definir categoria no produto da loja B, e tê-la explícita
 * é o que torna esse isolamento uma regra testável em vez de um detalhe que
 * alguém pode esquecer numa cláusula `where`.
 */
export interface RepositorioCategoria {
  acharProduto(tenantId: string, produtoId: string): Promise<(ProdutoParaEscolha & { grupo: string | null }) | null>;
  gravar(tenantId: string, produtoId: string, dados: { categoriaId: string; preparo: Preparo }): Promise<void>;
}

export const repositorioPrisma: RepositorioCategoria = {
  async acharProduto(tenantId, produtoId) {
    const p = await prisma.produto.findFirst({
      where: { id: produtoId, tenantId },
      select: {
        id: true, nome: true, marca: true, sku: true, gtin: true, atributos: true,
        categoria: { select: { nome: true } },
      },
    });
    return p ? { ...p, grupo: p.categoria?.nome ?? null } : null;
  },
  async gravar(tenantId, produtoId, { categoriaId, preparo }) {
    const comum = {
      categoriaMl: categoriaId,
      categoriaOrigem: "manual",
      categoriaDefinidaEm: new Date(),
      preparo: preparo as unknown as object,
      preparoEstado: preparo.estado,
      preparadoEm: new Date(),
    };
    await prisma.anuncioMercadoLivre.upsert({
      where: { tenantId_produtoId: { tenantId, produtoId } },
      create: { tenantId, produtoId, ...comum },
      // `estado`, `mlbId` e `permalink` são da publicação: trocar a categoria
      // de um produto não pode apagar o anúncio dele que já está no ar.
      update: comum,
    });
  },
};

export class ProdutoNaoEncontrado extends Error {}

/**
 * Define a categoria à mão e devolve o produto já rediagnosticado.
 *
 * A ordem importa: acha o produto **da loja**, consulta o ML, recalcula os
 * atributos e só então grava. Assim o lojista vê na mesma resposta o que ainda
 * falta — "Categoria definida ✓ / ainda faltam marca e GTIN" — em vez de
 * descobrir tentando publicar.
 */
export async function definirCategoriaManual(
  tenantId: string,
  produtoId: string,
  categoriaId: string,
  repo: RepositorioCategoria = repositorioPrisma,
): Promise<{ preparo: Preparo; categoria: CategoriaEncontrada }> {
  const produto = await repo.acharProduto(tenantId, produtoId);
  if (!produto) throw new ProdutoNaoEncontrado("Produto não encontrado nesta loja.");

  const r = await preparoNaCategoria(produto, categoriaId, produto.grupo);
  await repo.gravar(tenantId, produtoId, { categoriaId: r.categoria.categoriaId, preparo: r.preparo });
  return r;
}
