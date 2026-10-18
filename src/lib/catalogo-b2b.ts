import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { EntradaCatalogoB2B } from "./catalogo-b2b-schema";
import { resolverOfertaB2B, type AtribuicaoResolucaoB2B } from "./catalogo-b2b-resolver";

const incluirCatalogo = {
  versoes: {
    include: {
      atribuicoes: { orderBy: [{ prioridade: "desc" as const }, { id: "asc" as const }] },
      itens: { include: { componentes: { orderBy: { varianteId: "asc" as const } } }, orderBy: { id: "asc" as const } },
      auditorias: { orderBy: { criadoEm: "asc" as const } },
    },
    orderBy: { versao: "asc" as const },
  },
} satisfies Prisma.CatalogoB2BInclude;

export async function obterCatalogoB2B(tenantId: string, catalogoId: string) {
  return prisma.catalogoB2B.findFirstOrThrow({ where: { tenantId, id: catalogoId }, include: incluirCatalogo });
}

async function empresaPorReferencia(tx: Prisma.TransactionClient, tenantId: string, referencia: string) {
  const empresa = await tx.empresaB2B.findUnique({ where: { tenantId_referencia: { tenantId, referencia } } });
  if (!empresa) throw new Error(`Empresa não encontrada: ${referencia}.`);
  return empresa;
}

async function unidadePorReferencia(tx: Prisma.TransactionClient, tenantId: string, empresaId: string, referencia: string | null) {
  if (referencia === null) return null;
  const unidade = await tx.unidadeEmpresaB2B.findUnique({ where: { tenantId_empresaId_referencia: { tenantId, empresaId, referencia } } });
  if (!unidade) throw new Error(`Unidade não encontrada na empresa: ${referencia}.`);
  return unidade;
}

async function produtoPorReferencia(tx: Prisma.TransactionClient, tenantId: string, referencia: string) {
  const produto = await tx.produto.findFirst({ where: { tenantId, OR: [{ id: referencia }, { sku: referencia }] } });
  if (!produto) throw new Error(`Produto não encontrado: ${referencia}.`);
  return produto;
}

async function variantePorReferencia(tx: Prisma.TransactionClient, tenantId: string, produtoId: string, referencia: string | null) {
  if (referencia === null) return null;
  const variante = await tx.variante.findFirst({ where: { tenantId, produtoId, OR: [{ id: referencia }, { sku: referencia }] } });
  if (!variante) throw new Error(`Variante não encontrada no produto: ${referencia}.`);
  return variante;
}

async function componentePorReferencia(tx: Prisma.TransactionClient, tenantId: string, referencia: string) {
  const variante = await tx.variante.findFirst({ where: { tenantId, OR: [{ id: referencia }, { sku: referencia }] } });
  if (!variante) throw new Error(`Variante do componente não encontrada: ${referencia}.`);
  return variante;
}

async function salvarNaTransacao(tx: Prisma.TransactionClient, tenantId: string, entrada: EntradaCatalogoB2B) {
  const catalogo = await tx.catalogoB2B.upsert({
    where: { tenantId_referencia: { tenantId, referencia: entrada.referencia } },
    create: { tenantId, referencia: entrada.referencia, nome: entrada.nome },
    update: { nome: entrada.nome },
  });
  const existente = await tx.versaoCatalogoB2B.findUnique({
    where: { tenantId_catalogoId_versao: { tenantId, catalogoId: catalogo.id, versao: entrada.versao } },
  });
  if (existente?.estado === "APROVADA") throw new Error("A versão aprovada é imutável.");

  const versao = existente
    ? await tx.versaoCatalogoB2B.update({ where: { id: existente.id }, data: { moeda: entrada.moeda, vigenteDesde: entrada.vigenteDesde, vigenteAte: entrada.vigenteAte } })
    : await tx.versaoCatalogoB2B.create({ data: { tenantId, catalogoId: catalogo.id, versao: entrada.versao, moeda: entrada.moeda, vigenteDesde: entrada.vigenteDesde, vigenteAte: entrada.vigenteAte } });

  if (existente) {
    await tx.atribuicaoCatalogoB2B.deleteMany({ where: { tenantId, versaoId: versao.id } });
    await tx.itemCatalogoB2B.deleteMany({ where: { tenantId, versaoId: versao.id } });
  }

  for (const atribuicao of entrada.atribuicoes) {
    const empresa = await empresaPorReferencia(tx, tenantId, atribuicao.empresaReferencia);
    const unidade = await unidadePorReferencia(tx, tenantId, empresa.id, atribuicao.unidadeReferencia);
    await tx.atribuicaoCatalogoB2B.create({ data: { tenantId, versaoId: versao.id, empresaId: empresa.id, unidadeId: unidade?.id ?? null, prioridade: atribuicao.prioridade } });
  }

  for (const entradaItem of entrada.itens) {
    const produto = await produtoPorReferencia(tx, tenantId, entradaItem.produtoReferencia);
    const variante = await variantePorReferencia(tx, tenantId, produto.id, entradaItem.varianteReferencia);
    const item = await tx.itemCatalogoB2B.create({ data: {
      tenantId,
      versaoId: versao.id,
      produtoId: produto.id,
      varianteId: variante?.id ?? null,
      acao: entradaItem.acao,
      estrategiaPreco: entradaItem.acao === "EXCLUIR" ? "FIXO" : entradaItem.estrategiaPreco,
      precoFixoCentavos: entradaItem.acao === "INCLUIR" && entradaItem.estrategiaPreco === "FIXO" ? entradaItem.precoFixoCentavos : null,
      descontoPontosBase: entradaItem.acao === "INCLUIR" && entradaItem.estrategiaPreco === "DESCONTO" ? entradaItem.descontoPontosBase : null,
      quantidadeMinima: entradaItem.quantidadeMinima,
      quantidadeMaxima: entradaItem.quantidadeMaxima,
      multiploVenda: entradaItem.multiploVenda,
      quantidadePorEmbalagem: entradaItem.quantidadePorEmbalagem,
      unidadeComercial: entradaItem.unidadeComercial,
      unidadesBaseNumerador: entradaItem.unidadesBaseNumerador,
      unidadesBaseDenominador: entradaItem.unidadesBaseDenominador,
    } });
    for (const entradaComponente of entradaItem.componentes) {
      const componente = await componentePorReferencia(tx, tenantId, entradaComponente.varianteReferencia);
      await tx.componenteKitCatalogoB2B.create({ data: {
        tenantId,
        itemId: item.id,
        varianteId: componente.id,
        quantidadeBaseNumerador: entradaComponente.quantidadeBaseNumerador,
        quantidadeBaseDenominador: entradaComponente.quantidadeBaseDenominador,
      } });
    }
  }
  return catalogo;
}

export async function salvarCatalogoB2B(tenantId: string, entrada: EntradaCatalogoB2B) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await prisma.$transaction((tx) => salvarNaTransacao(tx, tenantId, entrada), { isolationLevel: "Serializable" });
    } catch (erro) {
      if (tentativa < 3 && erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") continue;
      throw erro;
    }
  }
  throw new Error("Não foi possível salvar o catálogo B2B.");
}

function snapshotDaVersao(versao: Awaited<ReturnType<typeof obterCatalogoB2B>>["versoes"][number]) {
  return {
    catalogoId: versao.catalogoId,
    versao: versao.versao,
    moeda: versao.moeda,
    vigenteDesde: versao.vigenteDesde.toISOString(),
    vigenteAte: versao.vigenteAte?.toISOString() ?? null,
    atribuicoes: versao.atribuicoes.map((a) => [a.empresaId, a.unidadeId, a.prioridade, a.id]).sort(),
    itens: versao.itens.map((i) => ({
      id: i.id, produtoId: i.produtoId, varianteId: i.varianteId, acao: i.acao, estrategiaPreco: i.estrategiaPreco,
      precoFixoCentavos: i.precoFixoCentavos, descontoPontosBase: i.descontoPontosBase,
      quantidadeMinima: i.quantidadeMinima, quantidadeMaxima: i.quantidadeMaxima, multiploVenda: i.multiploVenda,
      quantidadePorEmbalagem: i.quantidadePorEmbalagem, unidadeComercial: i.unidadeComercial,
      unidadesBaseNumerador: i.unidadesBaseNumerador, unidadesBaseDenominador: i.unidadesBaseDenominador,
      componentes: i.componentes.map((c) => [c.varianteId, c.quantidadeBaseNumerador, c.quantidadeBaseDenominador]).sort(),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function aprovarNaTransacao(tx: Prisma.TransactionClient, tenantId: string, catalogoId: string, numeroVersao: number, ator: string) {
    const catalogo = await tx.catalogoB2B.findFirst({ where: { tenantId, id: catalogoId }, include: incluirCatalogo });
    if (!catalogo) throw new Error("Catálogo B2B não encontrado.");
    const versao = catalogo.versoes.find((item) => item.versao === numeroVersao);
    if (!versao) throw new Error("Versão do catálogo B2B não encontrada.");
    if (versao.estado === "APROVADA") return versao;
    if (versao.itens.length === 0) throw new Error("A aprovação exige ao menos um item.");
    const conteudoHash = createHash("sha256").update(JSON.stringify(snapshotDaVersao(versao))).digest("hex");
    const aprovadoEm = new Date();
    const alterada = await tx.versaoCatalogoB2B.updateMany({
      where: { tenantId, id: versao.id, estado: "RASCUNHO" },
      data: { estado: "APROVADA", aprovadoEm, aprovadoPor: ator, conteudoHash },
    });
    if (alterada.count === 0) return tx.versaoCatalogoB2B.findFirstOrThrow({ where: { tenantId, id: versao.id }, include: { atribuicoes: true, itens: { include: { componentes: true } }, auditorias: true } });
    await tx.auditoriaCatalogoB2B.create({ data: { tenantId, catalogoId, versaoId: versao.id, acao: "APROVADA", ator, conteudoHash } });
    return tx.versaoCatalogoB2B.findFirstOrThrow({ where: { tenantId, id: versao.id }, include: { atribuicoes: true, itens: { include: { componentes: true } }, auditorias: true } });
}

export async function aprovarVersaoCatalogoB2B(tenantId: string, catalogoId: string, numeroVersao: number, ator: string) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await prisma.$transaction(
        (tx) => aprovarNaTransacao(tx, tenantId, catalogoId, numeroVersao, ator),
        { isolationLevel: "Serializable" },
      );
    } catch (erro) {
      if (tentativa < 3 && erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") continue;
      throw erro;
    }
  }
  throw new Error("Não foi possível aprovar o catálogo B2B.");
}

export type EntradaResolverCatalogoB2B = {
  empresaId: string;
  unidadeId: string | null;
  produtoId: string;
  varianteId: string | null;
  quantidade: number;
  agora: Date;
};

/**
 * Resolve a condição comercial sem reservar nem baixar estoque. A composição
 * racional devolvida aqui será consumida pelo checkout/estoque em entregas
 * posteriores; esta consulta é deliberadamente somente leitura.
 */
export async function resolverCatalogoB2B(tenantId: string, entrada: EntradaResolverCatalogoB2B) {
  const produto = await prisma.produto.findFirst({
    where: { tenantId, id: entrada.produtoId },
    select: { id: true, nome: true, sku: true, gtin: true, marca: true, ncm: true, cest: true, atributos: true, precoCentavos: true },
  });
  if (!produto) throw new Error("Produto não encontrado.");
  const variante = entrada.varianteId === null
    ? null
    : await prisma.variante.findFirst({
      where: { tenantId, produtoId: produto.id, id: entrada.varianteId },
      include: { preco: true },
    });
  if (entrada.varianteId !== null && !variante) throw new Error("Variante não encontrada no produto.");
  const precoBaseCentavos = variante?.preco?.valorCentavos ?? variante?.precoCentavos ?? produto.precoCentavos;

  const versoes = await prisma.versaoCatalogoB2B.findMany({
    where: {
      tenantId,
      estado: "APROVADA",
      vigenteDesde: { lte: entrada.agora },
      OR: [{ vigenteAte: null }, { vigenteAte: { gt: entrada.agora } }],
      atribuicoes: { some: { empresaId: entrada.empresaId, OR: [{ unidadeId: null }, { unidadeId: entrada.unidadeId ?? "" }] } },
    },
    include: {
      atribuicoes: { where: { empresaId: entrada.empresaId, OR: [{ unidadeId: null }, { unidadeId: entrada.unidadeId ?? "" }] } },
      itens: { where: { produtoId: produto.id }, include: { componentes: true } },
    },
  });

  const atribuicoes: AtribuicaoResolucaoB2B[] = versoes.flatMap((versao) => versao.atribuicoes.map((atribuicao) => ({
    id: atribuicao.id,
    catalogoVersaoId: versao.id,
    empresaId: atribuicao.empresaId,
    unidadeId: atribuicao.unidadeId,
    prioridade: atribuicao.prioridade,
    versao: versao.versao,
    vigenteDesde: versao.vigenteDesde,
    vigenteAte: versao.vigenteAte,
    itens: versao.itens.map((item) => ({
      id: item.id,
      produtoId: item.produtoId,
      varianteId: item.varianteId,
      acao: item.acao,
      estrategiaPreco: item.estrategiaPreco,
      precoFixoCentavos: item.precoFixoCentavos,
      descontoPontosBase: item.descontoPontosBase,
      quantidadeMinima: item.quantidadeMinima,
      quantidadeMaxima: item.quantidadeMaxima,
      multiploVenda: item.multiploVenda,
      quantidadePorEmbalagem: item.quantidadePorEmbalagem,
      unidadeComercial: item.unidadeComercial,
      unidadesBaseNumerador: item.unidadesBaseNumerador,
      unidadesBaseDenominador: item.unidadesBaseDenominador,
      componentes: item.componentes.map((componente) => ({
        varianteId: componente.varianteId,
        quantidadeBaseNumerador: componente.quantidadeBaseNumerador,
        quantidadeBaseDenominador: componente.quantidadeBaseDenominador,
      })),
    })),
  })));

  return {
    produto: { id: produto.id, nome: produto.nome, sku: produto.sku, gtin: produto.gtin, marca: produto.marca, ncm: produto.ncm, cest: produto.cest, atributos: produto.atributos },
    variante: variante ? { id: variante.id, nome: variante.nome, sku: variante.sku, gtin: variante.gtin, mpn: variante.mpn } : null,
    oferta: resolverOfertaB2B({ ...entrada, precoBaseCentavos, atribuicoes }),
  };
}
