import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";

/**
 * A consulta do catálogo para quem administra a loja de fora (o painel da
 * Ávila Ops): uma página de produtos, com os totais de que a tela precisa.
 *
 * Existe porque a alternativa era mandar o catálogo inteiro e deixar o painel
 * filtrar — 16 MB na loja de 5.634 peças, depois 2,9 MB com a lista enxuta.
 * Aqui a busca, os filtros, a ordenação, a paginação e as contagens são do
 * banco: sai uma página e os números.
 *
 * Duas regras que este arquivo guarda num lugar só:
 *
 * - **Contagem e listagem usam a mesma expressão.** Cada pendência é uma
 *   coluna booleana calculada uma vez (`BASE`), lida tanto pelo indicador
 *   quanto pelo filtro. Não há como o número dizer 7 e a lista trazer 6.
 * - **Estoque vem das variações, não da cópia no produto.** `Produto.estoque`
 *   é projeção da variação principal. O que vale é o saldo: físico menos
 *   reservado, somado nas variações ativas (a grade quando existe; senão a
 *   apresentação única). Três estados que não se confundem:
 *   `desconhecido` (nenhum saldo cadastrado), `nao-controla` (há saldo sem
 *   contagem) e `controlado` (há número — que pode ser zero ou negativo).
 */

const PENDENCIAS = ["sem-foto", "sob-consulta", "anuncia-sem-saldo", "foto-de-outro"] as const;
const ORDENS = ["nome-az", "nome-za", "preco-asc", "preco-desc", "marca", "categoria", "estoque-asc", "estoque-desc", "atualizado"] as const;
const GRUPOS = ["categoria", "marca", "situacao"] as const;

export const SEM_CATEGORIA = "~sem-categoria";
export const SEM_MARCA = "~sem-marca";

const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** O que a URL pode pedir. Valor desconhecido é erro 422, não filtro ignorado em silêncio. */
export const ConsultaDoCatalogo = z
  .object({
    q: z.string().trim().max(120).default(""),
    categoria: z.string().max(120).default(""),
    marca: z.string().max(120).default(""),
    situacao: z.enum(["", "ativos", "inativos"]).default(""),
    pend: z.array(z.enum(PENDENCIAS)).max(4).default([]),
    estoque: z.enum(["", "com-saldo", "zerado", "nao-controla", "desconhecido"]).default(""),
    /** Centavos. */
    min: z.coerce.number().int().min(0).max(10_000_000_000).optional(),
    max: z.coerce.number().int().min(0).max(10_000_000_000).optional(),
    ordem: z.enum(ORDENS).default("nome-az"),
    grupo: z.enum(["", ...GRUPOS]).default(""),
    por: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n), "25, 50 ou 100").default(25),
    pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  })
  .strict();

export type ConsultaDoCatalogo = z.infer<typeof ConsultaDoCatalogo>;

export function lerConsulta(params: URLSearchParams) {
  const bruto: Record<string, unknown> = {};
  for (const chave of new Set(params.keys())) bruto[chave] = chave === "pend" ? lista(params.getAll(chave)) : (params.get(chave) ?? "");
  return ConsultaDoCatalogo.safeParse(bruto);
}

/** Minúsculas e sem acento, do mesmo jeito nos dois lados da comparação. */
const DE = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const PARA = "aaaaaeeeeiiiiooooouuuucn";
const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Uma linha por produto da loja, com tudo o que filtro, indicador e ordenação
 * leem. É a única definição de cada regra.
 */
function base(tenantId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      p.id, p.slug, p.nome, p.marca, p.sku,
      p."precoCentavos", p."precoDeCentavos",
      p.imagens[1] AS imagem, cardinality(p.imagens) AS fotos, p."imagemOrigem",
      p.destaque, p.ativo, p.disponibilidade, p."atualizadoEm", p."criadoEm", p."versaoCatalogo",
      c.nome AS "categoriaNome", c.slug AS "categoriaSlug",
      e.variacoes,
      e.estado AS "estoqueEstado",
      CASE WHEN e.estado = 'controlado' THEN e.disponivel END AS estoque,
      translate(lower(p.nome || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.marca, '')), ${DE}, ${PARA}) AS alvo,
      cardinality(p.imagens) = 0 AS "semFoto",
      p."precoCentavos" <= 0 AS "sobConsulta",
      cardinality(p.imagens) > 0 AND p."imagemOrigem" <> 'propria' AS "fotoDeOutro",
      p.disponibilidade = 'in_stock' AND e.estado = 'controlado' AND e.disponivel <= 0 AS "anunciaSemSaldo"
    FROM "Produto" p
    LEFT JOIN "Categoria" c ON c.id = p."categoriaId"
    LEFT JOIN LATERAL (
      SELECT
        count(DISTINCT v.id) FILTER (WHERE NOT v.padrao)::int AS variacoes,
        CASE
          WHEN count(s.id) = 0 THEN 'desconhecido'
          WHEN bool_or(s.fisico IS NULL) THEN 'nao-controla'
          ELSE 'controlado'
        END AS estado,
        coalesce(sum(s.fisico - s.reservado) FILTER (WHERE s.fisico IS NOT NULL), 0)::int AS disponivel
      FROM "Variante" v
      LEFT JOIN "SaldoEstoque" s ON s."varianteId" = v.id AND s."tenantId" = v."tenantId"
      WHERE v."produtoId" = p.id AND v."tenantId" = p."tenantId" AND v.ativo
        -- Com grade, quem vende são as variações; a apresentação única é só o molde.
        AND v.padrao = NOT EXISTS (
          SELECT 1 FROM "Variante" g WHERE g."produtoId" = p.id AND g."tenantId" = p."tenantId" AND g.ativo AND NOT g.padrao
        )
    ) e ON true
    WHERE p."tenantId" = ${tenantId}`;
}

const E = (partes: Prisma.Sql[]) => (partes.length ? Prisma.sql`WHERE ${Prisma.join(partes, " AND ")}` : Prisma.empty);

function filtros(c: ConsultaDoCatalogo): Prisma.Sql {
  const partes: Prisma.Sql[] = [];
  for (const termo of semAcento(c.q).split(/\s+/).filter(Boolean)) {
    // `%` e `_` digitados são texto, não curinga.
    partes.push(Prisma.sql`b.alvo LIKE ${`%${termo.replace(/[\\%_]/g, "\\$&")}%`}`);
  }
  if (c.categoria === SEM_CATEGORIA) partes.push(Prisma.sql`b."categoriaSlug" IS NULL`);
  else if (c.categoria) partes.push(Prisma.sql`b."categoriaSlug" = ${c.categoria}`);
  if (c.marca === SEM_MARCA) partes.push(Prisma.sql`coalesce(b.marca, '') = ''`);
  else if (c.marca) partes.push(Prisma.sql`b.marca = ${c.marca}`);
  if (c.situacao === "ativos") partes.push(Prisma.sql`b.ativo`);
  if (c.situacao === "inativos") partes.push(Prisma.sql`NOT b.ativo`);
  if (c.pend.includes("sem-foto")) partes.push(Prisma.sql`b."semFoto"`);
  if (c.pend.includes("sob-consulta")) partes.push(Prisma.sql`b."sobConsulta"`);
  if (c.pend.includes("anuncia-sem-saldo")) partes.push(Prisma.sql`b."anunciaSemSaldo"`);
  if (c.pend.includes("foto-de-outro")) partes.push(Prisma.sql`b."fotoDeOutro"`);
  if (c.estoque === "com-saldo") partes.push(Prisma.sql`b."estoqueEstado" = 'controlado' AND b.estoque > 0`);
  if (c.estoque === "zerado") partes.push(Prisma.sql`b."estoqueEstado" = 'controlado' AND b.estoque <= 0`);
  if (c.estoque === "nao-controla") partes.push(Prisma.sql`b."estoqueEstado" = 'nao-controla'`);
  if (c.estoque === "desconhecido") partes.push(Prisma.sql`b."estoqueEstado" = 'desconhecido'`);
  if (c.min !== undefined || c.max !== undefined) {
    // Faixa de preço é sobre quem TEM preço: "sob consulta" não é R$ 0,00.
    partes.push(Prisma.sql`NOT b."sobConsulta"`);
    if (c.min !== undefined) partes.push(Prisma.sql`b."precoCentavos" >= ${c.min}`);
    if (c.max !== undefined) partes.push(Prisma.sql`b."precoCentavos" <= ${c.max}`);
  }
  return E(partes);
}

// Português do Brasil, com número contando como número: "Item 2" antes de
// "Item 10". A colação é criada por migração (`ptbr_natural`).
const NOME = Prisma.sql`b.nome COLLATE "ptbr_natural"`;

function chaveDoGrupo(grupo: ConsultaDoCatalogo["grupo"]): Prisma.Sql | null {
  if (grupo === "categoria") return Prisma.sql`coalesce(b."categoriaNome", 'Sem categoria')`;
  if (grupo === "marca") return Prisma.sql`coalesce(nullif(b.marca, ''), 'Sem marca')`;
  if (grupo === "situacao") return Prisma.sql`CASE WHEN b.ativo THEN 'Ativos' ELSE 'Inativos' END`;
  return null;
}

function ordenacao(c: ConsultaDoCatalogo): Prisma.Sql {
  // Valor ausente vai para o fim nas duas direções: quem ordena por preço quer ver preço.
  const preco = Prisma.sql`CASE WHEN b."sobConsulta" THEN NULL ELSE b."precoCentavos" END`;
  const dentro: Record<ConsultaDoCatalogo["ordem"], Prisma.Sql> = {
    "nome-az": Prisma.sql`${NOME} ASC`,
    "nome-za": Prisma.sql`${NOME} DESC`,
    "preco-asc": Prisma.sql`${preco} ASC NULLS LAST, ${NOME} ASC`,
    "preco-desc": Prisma.sql`${preco} DESC NULLS LAST, ${NOME} ASC`,
    marca: Prisma.sql`nullif(b.marca, '') COLLATE "ptbr_natural" ASC NULLS LAST, ${NOME} ASC`,
    categoria: Prisma.sql`b."categoriaNome" COLLATE "ptbr_natural" ASC NULLS LAST, ${NOME} ASC`,
    "estoque-asc": Prisma.sql`b.estoque ASC NULLS LAST, ${NOME} ASC`,
    "estoque-desc": Prisma.sql`b.estoque DESC NULLS LAST, ${NOME} ASC`,
    atualizado: Prisma.sql`b."atualizadoEm" DESC, ${NOME} ASC`,
  };
  const partes: Prisma.Sql[] = [];
  if (c.grupo === "categoria") partes.push(Prisma.sql`(b."categoriaNome" IS NULL) ASC, b."categoriaNome" COLLATE "ptbr_natural" ASC`);
  if (c.grupo === "marca") partes.push(Prisma.sql`(coalesce(b.marca, '') = '') ASC, b.marca COLLATE "ptbr_natural" ASC`);
  if (c.grupo === "situacao") partes.push(Prisma.sql`b.ativo DESC`);
  // O id no fim desempata: sem ele dois produtos de mesmo nome poderiam trocar
  // de lugar entre uma página e outra.
  return Prisma.sql`ORDER BY ${Prisma.join([...partes, dentro[c.ordem], Prisma.sql`b.id ASC`], ", ")}`;
}

type Linha = {
  id: string; slug: string; nome: string; marca: string | null; sku: string | null;
  precoCentavos: number; precoDeCentavos: number | null;
  imagem: string | null; fotos: number; imagemOrigem: string;
  destaque: boolean; ativo: boolean; disponibilidade: string;
  atualizadoEm: Date; criadoEm: Date; versaoCatalogo: number;
  categoriaNome: string | null; categoriaSlug: string | null;
  variacoes: number; estoqueEstado: "desconhecido" | "nao-controla" | "controlado"; estoque: number | null;
};

const n = (valor: unknown) => Number(valor ?? 0);

export async function consultarCatalogo(tenantId: string, c: ConsultaDoCatalogo) {
  const b = base(tenantId);
  const onde = filtros(c);
  const grupo = chaveDoGrupo(c.grupo);

  const [resumo, categorias, marcas, contagem] = await Promise.all([
    // Indicadores do catálogo INTEIRO da loja: não mudam com o filtro.
    prisma.$queryRaw<Array<Record<string, bigint>>>(Prisma.sql`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE b.ativo) AS ativos,
        count(*) FILTER (WHERE NOT b.ativo) AS inativos,
        -- Pendência só conta em produto ativo: rascunho incompleto é trabalho em andamento.
        count(*) FILTER (WHERE b.ativo AND b."semFoto") AS "semFoto",
        count(*) FILTER (WHERE b.ativo AND b."sobConsulta") AS "sobConsulta",
        count(*) FILTER (WHERE b.ativo AND b."anunciaSemSaldo") AS "anunciaSemSaldo",
        count(*) FILTER (WHERE b.ativo AND b."fotoDeOutro") AS "fotoDeOutroItem",
        count(*) FILTER (WHERE b."estoqueEstado" = 'controlado') AS "controlamEstoque",
        count(*) FILTER (WHERE b."estoqueEstado" = 'nao-controla') AS "naoControlamEstoque",
        count(*) FILTER (WHERE b."estoqueEstado" = 'desconhecido') AS "estoqueDesconhecido",
        count(*) FILTER (WHERE b.variacoes > 0) AS "comVariacoes"
      FROM (${b}) b`),
    prisma.$queryRaw<Array<{ valor: string | null; rotulo: string | null; total: bigint }>>(Prisma.sql`
      SELECT b."categoriaSlug" AS valor, b."categoriaNome" AS rotulo, count(*) AS total
      FROM (${b}) b GROUP BY 1, 2
      ORDER BY (b."categoriaSlug" IS NULL) ASC, b."categoriaNome" COLLATE "ptbr_natural" ASC`),
    prisma.$queryRaw<Array<{ valor: string | null; total: bigint }>>(Prisma.sql`
      SELECT nullif(b.marca, '') AS valor, count(*) AS total
      FROM (${b}) b GROUP BY 1
      ORDER BY (nullif(b.marca, '') IS NULL) ASC, nullif(b.marca, '') COLLATE "ptbr_natural" ASC`),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT count(*) AS total FROM (${b}) b ${onde}`),
  ]);

  const total = n(contagem[0]?.total);
  const paginas = Math.max(1, Math.ceil(total / c.por));
  // Página além do fim cai na última: o resultado pode ter encolhido entre um clique e outro.
  const pagina = Math.min(c.pagina, paginas);
  const inicio = (pagina - 1) * c.por;

  const [linhas, grupos] = await Promise.all([
    prisma.$queryRaw<Linha[]>(Prisma.sql`
      SELECT b.id, b.slug, b.nome, b.marca, b.sku, b."precoCentavos", b."precoDeCentavos", b.imagem, b.fotos, b."imagemOrigem",
             b.destaque, b.ativo, b.disponibilidade, b."atualizadoEm", b."criadoEm", b."versaoCatalogo",
             b."categoriaNome", b."categoriaSlug", b.variacoes, b."estoqueEstado", b.estoque
      FROM (${b}) b ${onde} ${ordenacao(c)} LIMIT ${c.por} OFFSET ${inicio}`),
    // O total de cada grupo no resultado INTEIRO, não só nas linhas desta página.
    grupo
      ? prisma.$queryRaw<Array<{ chave: string; total: bigint }>>(Prisma.sql`SELECT ${grupo} AS chave, count(*) AS total FROM (${b}) b ${onde} GROUP BY 1`)
      : Promise.resolve([] as Array<{ chave: string; total: bigint }>),
  ]);

  const r = resumo[0] ?? {};
  return {
    itens: linhas.map(({ categoriaNome, categoriaSlug, ...p }) => ({
      ...p,
      categoria: categoriaSlug && categoriaNome ? { nome: categoriaNome, slug: categoriaSlug } : null,
    })),
    total,
    pagina,
    paginas,
    por: c.por,
    de: linhas.length ? inicio + 1 : 0,
    ate: inicio + linhas.length,
    grupos: grupos.map((g) => ({ chave: g.chave, total: n(g.total) })),
    resumo: Object.fromEntries(Object.entries(r).map(([chave, valor]) => [chave, n(valor)])) as Record<
      | "total" | "ativos" | "inativos" | "semFoto" | "sobConsulta" | "anunciaSemSaldo" | "fotoDeOutroItem"
      | "controlamEstoque" | "naoControlamEstoque" | "estoqueDesconhecido" | "comVariacoes",
      number
    >,
    facetas: {
      categorias: categorias.map((x) => ({ valor: x.valor ?? SEM_CATEGORIA, rotulo: x.rotulo ?? "Sem categoria", total: n(x.total) })),
      marcas: marcas.map((x) => ({ valor: x.valor ?? SEM_MARCA, rotulo: x.valor ?? "Sem marca", total: n(x.total) })),
    },
    lidoEm: new Date().toISOString(),
  };
}

export type ResultadoDaConsulta = Awaited<ReturnType<typeof consultarCatalogo>>;
