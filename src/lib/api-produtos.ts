import { z } from "zod";
import { prisma } from "./db";
import { ErroApi } from "./api-resposta";
import { slugificar } from "./catalogo";
import { invalidarCatalogo } from "./catalogo-cache";
import { salvarProdutoNoCatalogo } from "./catalogo-escrita";
import { ErroCatalogo } from "./catalogo-oferta";

/**
 * Criar e editar produto pela API para desenvolvedores.
 *
 * A escrita é a mesma do painel (`salvarProdutoNoCatalogo`): mesma trava,
 * histórico e projeções. O que este arquivo acrescenta é o contrato de entrada
 * — o que um ERP pode mandar — e a tradução dos erros para o formato da API.
 *
 * Duas decisões que valem explicar:
 *
 * - **Edição não mexe em preço nem estoque.** Quem sincroniza isso é
 *   `PATCH /api/v1/ofertas`, por SKU e em lote, com valor absoluto. Dois
 *   caminhos para o mesmo número é como o ERP e o cadastro passam a brigar.
 * - **Sem imagem.** A foto do produto entra pelo painel, que guarda o arquivo
 *   no nosso armazenamento. Aceitar URL de fora aqui poria na vitrine de um
 *   cliente uma imagem que a loja não controla e que pode sumir ou mudar.
 */

/** R$ 100 milhões: acima disso é centavos confundidos com reais multiplicados de novo. */
const TETO_CENTAVOS = 10_000_000_000;

const texto = (max: number) => z.string().trim().min(1).max(max);

const Editorial = {
  nome: texto(200),
  slug: texto(120),
  marca: texto(80).nullable(),
  descricaoCurta: texto(300).nullable(),
  descricao: texto(20_000).nullable(),
  /** Slug de uma categoria que já existe na loja. `null` tira o produto da categoria. */
  categoria: texto(120).nullable(),
  ativo: z.boolean(),
  destaque: z.boolean(),
};

export const NovoProduto = z
  .object({
    nome: Editorial.nome,
    slug: Editorial.slug.optional(),
    marca: Editorial.marca.optional(),
    descricaoCurta: Editorial.descricaoCurta.optional(),
    descricao: Editorial.descricao.optional(),
    categoria: Editorial.categoria.optional(),
    ativo: Editorial.ativo.optional(),
    destaque: Editorial.destaque.optional(),
    sku: texto(100).optional(),
    gtin: z.string().trim().regex(/^\d{8,14}$/, "GTIN tem de 8 a 14 dígitos").optional(),
    precoCentavos: z.number().int("centavos inteiros").min(0).max(TETO_CENTAVOS),
    precoDeCentavos: z.number().int("centavos inteiros").positive().max(TETO_CENTAVOS).nullable().optional(),
    // Saldo físico. Nulo ou ausente = a loja não controla estoque deste produto.
    estoque: z.number().int("quantidade inteira").min(0).max(10_000_000).nullable().optional(),
    pesoKg: z.number().positive().max(1000).nullable().optional(),
  })
  // Campo desconhecido é erro: `preco: 49.9` em reais, ignorado em silêncio, é
  // o ERP achando que cadastrou o preço.
  .strict();

export const EdicaoDeProduto = z
  .object({
    nome: Editorial.nome.optional(),
    slug: Editorial.slug.optional(),
    marca: Editorial.marca.optional(),
    descricaoCurta: Editorial.descricaoCurta.optional(),
    descricao: Editorial.descricao.optional(),
    categoria: Editorial.categoria.optional(),
    ativo: Editorial.ativo.optional(),
    destaque: Editorial.destaque.optional(),
  })
  .strict()
  .refine((e) => Object.keys(e).length > 0, "informe ao menos um campo para alterar");

const INCLUIR = {
  categoria: { select: { id: true, slug: true, nome: true } },
  variantes: { where: { padrao: false }, orderBy: [{ ordem: "asc" as const }, { id: "asc" as const }] },
};

/** O id da categoria pelo slug, dentro da loja. Categoria que não existe é erro, não criação. */
async function categoriaDoSlug(tenantId: string, slug: string | null | undefined): Promise<string | null | undefined> {
  if (slug === undefined) return undefined;
  if (slug === null) return null;
  const c = await prisma.categoria.findFirst({ where: { tenantId, slug }, select: { id: true } });
  if (!c) throw new ErroApi("parametro_invalido", `\`categoria\`: não existe categoria com o slug "${slug}" nesta loja. Crie no painel antes.`);
  return c.id;
}

/** Violação de unicidade (slug ou SKU já em uso) vira `conflito`; o resto, o que o catálogo disse. */
function traduzir(e: unknown): never {
  if (e instanceof ErroApi) throw e;
  if (e instanceof ErroCatalogo) {
    throw new ErroApi(e.status === 404 ? "nao_encontrado" : e.status === 409 ? "conflito" : "parametro_invalido", e.message);
  }
  if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") {
    throw new ErroApi("conflito", "Já existe produto com este slug ou este SKU nesta loja.");
  }
  throw e;
}

function limparCache(tenantId: string) {
  // A gravação já está no banco. Falhar em limpar o cache da vitrine não pode
  // virar 500: o ERP leria "não gravou". O cache expira sozinho.
  try {
    invalidarCatalogo(tenantId);
  } catch (e) {
    console.error(`[api/v1/produtos] cache da loja ${tenantId} não foi limpo`, e);
  }
}

/**
 * Cria o produto. **Nasce inativo**, a menos que o corpo diga `ativo: true`:
 * produto criado por integração chega sem foto, e produto sem foto na vitrine é
 * o que o lojista descobre pelo cliente.
 */
export async function criarProdutoPelaApi(tenantId: string, dados: z.infer<typeof NovoProduto>, origem: string) {
  const { categoria, slug, ...resto } = dados;
  try {
    const categoriaId = await categoriaDoSlug(tenantId, categoria);
    const criado = await salvarProdutoNoCatalogo(
      tenantId,
      null,
      { ...resto, slug: slugificar(slug ?? dados.nome), ativo: dados.ativo ?? false, ...(categoriaId !== undefined ? { categoriaId } : {}) },
      { origem },
    );
    limparCache(tenantId);
    return await prisma.produto.findUniqueOrThrow({ where: { id: criado.id }, include: INCLUIR });
  } catch (e) {
    traduzir(e);
  }
}

/** Edita os campos editoriais. `idOuSlug` como no GET. */
export async function editarProdutoPelaApi(tenantId: string, idOuSlug: string, dados: z.infer<typeof EdicaoDeProduto>, origem: string, versao?: number) {
  const atual = await prisma.produto.findFirst({ where: { tenantId, OR: [{ id: idOuSlug }, { slug: idOuSlug }] }, select: { id: true } });
  if (!atual) throw new ErroApi("nao_encontrado", "Produto não encontrado nesta loja.");
  const { categoria, slug, ...resto } = dados;
  try {
    const categoriaId = await categoriaDoSlug(tenantId, categoria);
    await salvarProdutoNoCatalogo(
      tenantId,
      atual.id,
      { ...resto, ...(slug ? { slug: slugificar(slug) } : {}), ...(categoriaId !== undefined ? { categoriaId } : {}) },
      { origem, ...(versao !== undefined ? { versao } : {}) },
    );
    limparCache(tenantId);
    return await prisma.produto.findUniqueOrThrow({ where: { id: atual.id }, include: INCLUIR });
  } catch (e) {
    traduzir(e);
  }
}
