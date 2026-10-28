import { randomUUID } from "node:crypto";
import { Prisma, type EstadoCotacaoB2B } from "@prisma/client";
import { prisma } from "./db";
import { resolverCatalogoB2B } from "./catalogo-b2b";
import { reservarEstoqueNaTransacao } from "./catalogo-reservas";

export type ItemCotacaoB2B = {
  produtoId: string;
  varianteId: string;
  nome: string;
  sku: string | null;
  quantidade: number;
  precoUnitarioCentavos: number;
  catalogoVersaoId: string | null;
};

export type AtorCotacaoB2B = { tipo: string; id?: string | null; email?: string | null };
export type AcaoCotacao = "CONTRAPOR" | "SUBMETER" | "APROVAR" | "RECUSAR" | "CANCELAR" | "EXPIRAR" | "CONVERTER";

const TRANSICOES: Record<EstadoCotacaoB2B, Partial<Record<AcaoCotacao, EstadoCotacaoB2B>>> = {
  RASCUNHO: { CONTRAPOR: "EM_NEGOCIACAO", SUBMETER: "AGUARDANDO_APROVACAO", CANCELAR: "CANCELADA", EXPIRAR: "EXPIRADA" },
  EM_NEGOCIACAO: { CONTRAPOR: "EM_NEGOCIACAO", SUBMETER: "AGUARDANDO_APROVACAO", CANCELAR: "CANCELADA", EXPIRAR: "EXPIRADA" },
  AGUARDANDO_APROVACAO: { APROVAR: "APROVADA", RECUSAR: "RECUSADA", CANCELAR: "CANCELADA", EXPIRAR: "EXPIRADA" },
  APROVADA: { CONVERTER: "CONVERTIDA", CANCELAR: "CANCELADA", EXPIRAR: "EXPIRADA" },
  RECUSADA: {}, EXPIRADA: {}, CANCELADA: {}, CONVERTIDA: {},
};

export function proximoEstadoCotacao(estado: EstadoCotacaoB2B, acao: AcaoCotacao): EstadoCotacaoB2B {
  const proximo = TRANSICOES[estado]?.[acao];
  if (!proximo) throw new Error(`Transição inválida: ${estado} -> ${acao}.`);
  return proximo;
}

export function totaisCotacao(itens: Array<Pick<ItemCotacaoB2B, "quantidade" | "precoUnitarioCentavos">>, descontoCentavos = 0, freteCentavos = 0) {
  if (!itens.length || itens.some((i) => !Number.isSafeInteger(i.quantidade) || i.quantidade <= 0 || !Number.isSafeInteger(i.precoUnitarioCentavos) || i.precoUnitarioCentavos < 0)) throw new Error("Itens da cotação inválidos.");
  if (![descontoCentavos, freteCentavos].every((v) => Number.isSafeInteger(v) && v >= 0)) throw new Error("Valores da cotação inválidos.");
  const subtotalCentavos = itens.reduce((s, i) => s + i.quantidade * i.precoUnitarioCentavos, 0);
  const maximo = 2_147_483_647; // Prisma Int / PostgreSQL integer.
  if (![subtotalCentavos, descontoCentavos, freteCentavos, subtotalCentavos - descontoCentavos + freteCentavos]
    .every(valor => Number.isSafeInteger(valor) && valor <= maximo)) throw new Error("Valores da cotação excedem o limite em centavos.");
  if (descontoCentavos > subtotalCentavos) throw new Error("Desconto não pode superar o subtotal.");
  return { subtotalCentavos, descontoCentavos, freteCentavos, totalCentavos: subtotalCentavos - descontoCentavos + freteCentavos };
}

export function conferirAprovacaoCotacao(
  cotacao: { totalCentavos: number; unidadeId: string | null; excecaoComercial: boolean; justificativa: string | null },
  escopos: Array<{ papel: string; unidadeId: string | null; limiteAprovacaoCentavos: number | null }>,
) {
  if (cotacao.excecaoComercial) {
    if (!cotacao.justificativa?.trim()) throw new Error("Exceção comercial exige justificativa.");
    if (!escopos.some((e) => e.papel === "ADMINISTRADOR" && e.unidadeId === null)) throw new Error("Exceção comercial exige administrador da organização.");
    return;
  }
  const aprovadores = escopos.filter((e) => ["APROVADOR", "ADMINISTRADOR"].includes(e.papel));
  const noEscopo = aprovadores.filter((e) => e.unidadeId === null || e.unidadeId === cotacao.unidadeId);
  if (!noEscopo.length) throw new Error("Aprovador fora do escopo da cotação.");
  if (!noEscopo.some((e) => e.limiteAprovacaoCentavos === null || e.limiteAprovacaoCentavos >= cotacao.totalCentavos)) throw new Error("Valor acima da alçada de aprovação.");
}

const incluirCotacao = {
  versoes: { orderBy: { numero: "asc" as const } },
  eventos: { orderBy: { criadoEm: "asc" as const } },
  anexos: { orderBy: { criadoEm: "asc" as const } },
  empresa: true, unidade: true,
  compradorEmpresa: { include: { comprador: { select: { id: true, telefone: true, documento: true } } } },
  centroCusto: true, pedido: { include: { itens: true } },
} satisfies Prisma.CotacaoB2BInclude;

function evento(tenantId: string, cotacaoId: string, tipo: string, ator: AtorCotacaoB2B, dados: Prisma.InputJsonValue = {}) {
  return { tenantId, cotacaoId, tipo, atorTipo: ator.tipo, atorId: ator.id ?? null, atorEmail: ator.email ?? null, dados };
}

/** Retry only transactions conclusively aborted by PostgreSQL, with no remote effect. */
async function transacaoCotacao<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable", timeout: 20000 });
    } catch (error) {
      // SELECT FOR UPDATE reports serialization/deadlock through P2010 SQLSTATE.
      const conflict = error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === "P2034" || error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code ?? "")));
      if (!conflict || attempt >= 5) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 15));
    }
  }
}

async function bloquearCotacao(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "CotacaoB2B" WHERE id=${id} AND "tenantId"=${tenantId} FOR UPDATE`;
  return tx.cotacaoB2B.findFirstOrThrow({
    where: { tenantId, id },
    include: { versoes: { orderBy: { numero: "asc" } } },
  });
}

export async function obterCotacaoB2B(tenantId: string, id: string) {
  return prisma.cotacaoB2B.findFirstOrThrow({ where: { tenantId, id }, include: incluirCotacao });
}

export async function expirarCotacoesVencidas(tenantId: string, agora = new Date()) {
  const vencidas = await prisma.cotacaoB2B.findMany({ where: { tenantId, validaAte: { lte: agora }, estado: { in: ["RASCUNHO", "EM_NEGOCIACAO", "AGUARDANDO_APROVACAO", "APROVADA"] } }, select: { id: true } });
  for (const cotacao of vencidas) await expirarCotacaoB2B(tenantId, cotacao.id, { tipo: "SISTEMA" });
  return vencidas.length;
}

async function resolverItens(tenantId: string, empresaId: string, unidadeId: string | null, itens: Array<{ produtoId: string; varianteId: string; quantidade: number; precoUnitarioCentavos?: number }>, agora: Date) {
  const resolvidos: ItemCotacaoB2B[] = [];
  let temPrecoNegociado = false;
  for (const item of itens) {
    const r = await resolverCatalogoB2B(tenantId, { empresaId, unidadeId, produtoId: item.produtoId, varianteId: item.varianteId, quantidade: item.quantidade, agora });
    if (r.oferta.tipo === "INDISPONIVEL") throw new Error(`Item indisponível: ${r.oferta.motivo}.`);
    if (item.precoUnitarioCentavos !== undefined && item.precoUnitarioCentavos !== r.oferta.precoUnitarioCentavos) temPrecoNegociado = true;
    resolvidos.push({ produtoId: r.produto.id, varianteId: item.varianteId, nome: r.variante ? `${r.produto.nome} · ${r.variante.nome}` : r.produto.nome, sku: r.variante?.sku ?? r.produto.sku, quantidade: item.quantidade, precoUnitarioCentavos: item.precoUnitarioCentavos ?? r.oferta.precoUnitarioCentavos, catalogoVersaoId: r.oferta.tipo === "OFERTA_B2B" ? r.oferta.catalogoVersaoId : null });
  }
  return { itens: resolvidos, temPrecoNegociado };
}

export type EntradaVersaoCotacao = { itens: Array<{ produtoId: string; varianteId: string; quantidade: number; precoUnitarioCentavos?: number }>; descontoCentavos?: number; freteCentavos?: number; condicoes?: Record<string, unknown>; justificativa?: string | null };
export type EntradaCriarCotacao = EntradaVersaoCotacao & { empresaId: string; unidadeId?: string | null; compradorEmpresaId?: string | null; centroCustoId?: string | null; pedidoCompra?: string | null; responsavelEmail: string; validaAte: Date; anexos?: Array<{ nome: string; url: string; tipoMime: string; tamanhoBytes: number }> };

export async function criarCotacaoB2B(tenantId: string, entrada: EntradaCriarCotacao, ator: AtorCotacaoB2B) {
  if (entrada.validaAte.getTime() <= Date.now()) throw new Error("Validade da cotação deve estar no futuro.");
  const resolucao = await resolverItens(tenantId, entrada.empresaId, entrada.unidadeId ?? null, entrada.itens, new Date());
  const itens = resolucao.itens;
  const totais = totaisCotacao(itens, entrada.descontoCentavos, entrada.freteCentavos);
  const excecaoComercial = resolucao.temPrecoNegociado || (entrada.descontoCentavos ?? 0) > 0;
  if (excecaoComercial && !entrada.justificativa?.trim()) throw new Error("Exceção comercial exige justificativa.");
  const referencia = `COT-${randomUUID()}`;
  const cotacao = await prisma.cotacaoB2B.create({ data: {
    tenantId, empresaId: entrada.empresaId, unidadeId: entrada.unidadeId ?? null, compradorEmpresaId: entrada.compradorEmpresaId ?? null,
    centroCustoId: entrada.centroCustoId ?? null, pedidoCompra: entrada.pedidoCompra?.trim() || null, referencia,
    responsavelEmail: entrada.responsavelEmail.trim(), validaAte: entrada.validaAte,
    versoes: { create: { numero: 1, autorTipo: ator.tipo, autorId: ator.id ?? null, autorEmail: ator.email ?? null, itens: itens as unknown as Prisma.InputJsonValue, ...totais, condicoes: (entrada.condicoes ?? {}) as Prisma.InputJsonValue, justificativa: entrada.justificativa?.trim() || null, excecaoComercial } },
    eventos: { create: { tipo: "CRIADA", atorTipo: ator.tipo, atorId: ator.id ?? null, atorEmail: ator.email ?? null, dados: { versao: 1 } } },
    anexos: entrada.anexos?.length ? { create: entrada.anexos } : undefined,
  }, include: incluirCotacao });
  return cotacao;
}

export async function contraproporCotacaoB2B(tenantId: string, id: string, entrada: EntradaVersaoCotacao, ator: AtorCotacaoB2B) {
  const atual = await obterCotacaoB2B(tenantId, id);
  if (atual.validaAte.getTime() <= Date.now()) throw new Error("Cotação expirada.");
  const resolucao = await resolverItens(tenantId, atual.empresaId, atual.unidadeId, entrada.itens, new Date());
  const itens = resolucao.itens;
  const totais = totaisCotacao(itens, entrada.descontoCentavos, entrada.freteCentavos);
  const excecaoComercial = resolucao.temPrecoNegociado || (entrada.descontoCentavos ?? 0) > 0;
  if (excecaoComercial && !entrada.justificativa?.trim()) throw new Error("Exceção comercial exige justificativa.");
  await transacaoCotacao(async (tx) => {
    const bloqueada = await bloquearCotacao(tx, tenantId, id);
    const estado = proximoEstadoCotacao(bloqueada.estado, "CONTRAPOR");
    if (bloqueada.validaAte.getTime() <= Date.now()) throw new Error("Cotação expirada.");
    const numero = bloqueada.versaoAtual + 1;
    await tx.versaoCotacaoB2B.create({ data: { tenantId, cotacaoId: id, numero, autorTipo: ator.tipo, autorId: ator.id ?? null, autorEmail: ator.email ?? null, itens: itens as unknown as Prisma.InputJsonValue, ...totais, condicoes: (entrada.condicoes ?? {}) as Prisma.InputJsonValue, justificativa: entrada.justificativa?.trim() || null, excecaoComercial } });
    await tx.cotacaoB2B.update({ where: { id }, data: { estado, versaoAtual: numero } });
    await tx.eventoCotacaoB2B.create({ data: evento(tenantId, id, "CONTRAPROPOSTA", ator, { versao: numero }) });
  });
  return obterCotacaoB2B(tenantId, id);
}

export async function submeterCotacaoB2B(tenantId: string, id: string, ator: AtorCotacaoB2B) {
  const atual = await obterCotacaoB2B(tenantId, id);
  if (atual.validaAte.getTime() <= Date.now()) return expirarCotacaoB2B(tenantId, id, ator);
  await transacaoCotacao(async (tx) => {
    const bloqueada = await bloquearCotacao(tx, tenantId, id);
    if (bloqueada.validaAte.getTime() <= Date.now()) throw new Error("Cotação expirada.");
    const estado = proximoEstadoCotacao(bloqueada.estado, "SUBMETER");
    await tx.cotacaoB2B.update({ where: { id }, data: { estado } });
    await tx.eventoCotacaoB2B.create({ data: evento(tenantId, id, "SUBMETIDA", ator, { versao: bloqueada.versaoAtual }) });
  });
  return obterCotacaoB2B(tenantId, id);
}

export async function aprovarCotacaoB2B(tenantId: string, id: string, aprovadorEmpresaId: string, ator: AtorCotacaoB2B) {
  const aprovadaPor = ator.email ?? ator.id ?? aprovadorEmpresaId;
  await transacaoCotacao(async (tx) => {
    const bloqueada = await bloquearCotacao(tx, tenantId, id);
    if (bloqueada.validaAte.getTime() <= Date.now()) throw new Error("Cotação expirada.");
    const estado = proximoEstadoCotacao(bloqueada.estado, "APROVAR");
    const versao = bloqueada.versoes.find((item) => item.numero === bloqueada.versaoAtual)!;
    const escopos = await tx.escopoCompradorB2B.findMany({ where: { tenantId, empresaId: bloqueada.empresaId, compradorEmpresaId: aprovadorEmpresaId } });
    conferirAprovacaoCotacao({ totalCentavos: versao.totalCentavos, unidadeId: bloqueada.unidadeId, excecaoComercial: versao.excecaoComercial, justificativa: versao.justificativa }, escopos);
    await tx.cotacaoB2B.update({ where: { id }, data: { estado, versaoAprovada: bloqueada.versaoAtual, aprovadaEm: new Date(), aprovadaPor, aprovacaoExcecao: versao.excecaoComercial, aprovacaoJustificativa: versao.justificativa } });
    await tx.eventoCotacaoB2B.create({ data: evento(tenantId, id, "APROVADA", ator, { versao: bloqueada.versaoAtual, excecaoComercial: versao.excecaoComercial, justificativa: versao.justificativa }) });
  });
  return obterCotacaoB2B(tenantId, id);
}

async function encerrar(tenantId: string, id: string, acao: "CANCELAR" | "EXPIRAR", ator: AtorCotacaoB2B, motivo?: string) {
  await transacaoCotacao(async (tx) => {
    const bloqueada = await bloquearCotacao(tx, tenantId, id);
    if (acao === "EXPIRAR" && bloqueada.estado === "EXPIRADA") return;
    const estado = proximoEstadoCotacao(bloqueada.estado, acao);
    await tx.cotacaoB2B.update({ where: { id }, data: { estado } });
    await tx.eventoCotacaoB2B.create({ data: evento(tenantId, id, acao === "CANCELAR" ? "CANCELADA" : "EXPIRADA", ator, { motivo: motivo ?? null }) });
  });
  return obterCotacaoB2B(tenantId, id);
}
export const cancelarCotacaoB2B = (tenantId: string, id: string, ator: AtorCotacaoB2B, motivo?: string) => encerrar(tenantId, id, "CANCELAR", ator, motivo);
export const expirarCotacaoB2B = (tenantId: string, id: string, ator: AtorCotacaoB2B) => encerrar(tenantId, id, "EXPIRAR", ator);

export async function recusarCotacaoB2B(tenantId: string, id: string, ator: AtorCotacaoB2B, motivo: string) {
  if (!motivo.trim()) throw new Error("Recusa exige motivo.");
  await transacaoCotacao(async (tx) => {
    const bloqueada = await bloquearCotacao(tx, tenantId, id);
    const estado = proximoEstadoCotacao(bloqueada.estado, "RECUSAR");
    await tx.cotacaoB2B.update({ where: { id }, data: { estado } });
    await tx.eventoCotacaoB2B.create({ data: evento(tenantId, id, "RECUSADA", ator, { motivo: motivo.trim() }) });
  });
  return obterCotacaoB2B(tenantId, id);
}

export async function converterCotacaoB2B(tenantId: string, id: string, chave: string, ator: AtorCotacaoB2B) {
  if (!chave.trim() || chave.trim().length < 8 || chave.trim().length > 200) throw new Error("Chave de idempotência inválida.");
  try {
    return await transacaoCotacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CotacaoB2B" WHERE id=${id} AND "tenantId"=${tenantId} FOR UPDATE`;
      const atual = await tx.cotacaoB2B.findFirstOrThrow({ where: { tenantId, id }, include: incluirCotacao });
      if (atual.pedido) return atual.pedido;
      if (atual.estado !== "APROVADA" || atual.versaoAprovada === null) throw new Error("Cotação precisa estar aprovada.");
      if (atual.validaAte.getTime() <= Date.now()) throw new Error("Cotação expirada.");
      const versao = atual.versoes.find(v => v.numero === atual.versaoAprovada);
      if (!versao) throw new Error("Versão aprovada não encontrada.");
      const itens = versao.itens as unknown as ItemCotacaoB2B[];
      const referencia = `cotacao:${id}`;
      const carrinho = itens.map(i => ({ id: `${i.produtoId}:${i.varianteId}`, nome: i.nome, sku: i.sku ?? undefined, quantidade: i.quantidade, precoUnitario: i.precoUnitarioCentavos }));
      await reservarEstoqueNaTransacao(tx, tenantId, referencia, carrinho, { validarPreco: false });
      const comprador = atual.compradorEmpresa?.comprador;
      const pedido = await tx.pedido.create({ data: {
        tenantId, referencia, status: "AGUARDANDO_PAGAMENTO", clienteNome: atual.compradorEmpresa?.nome ?? atual.empresa.razaoSocial,
        clienteEmail: atual.compradorEmpresa?.emailNormalizado ?? ator.email ?? atual.responsavelEmail, clienteTelefone: comprador?.telefone ?? "",
        clienteDocumento: comprador?.documento ?? "", freteNome: "Cotação B2B", freteCentavos: versao.freteCentavos,
        subtotalCentavos: versao.subtotalCentavos, descontoCentavos: versao.descontoCentavos, totalCentavos: versao.totalCentavos,
        compradorId: comprador?.id ?? null, meioPagamento: "faturado", canal: "loja", origem: `cotacao:${id}`,
        pedidoCompra: atual.pedidoCompra, empresaB2BId: atual.empresaId, unidadeB2BId: atual.unidadeId, centroCustoB2BId: atual.centroCustoId,
        cotacaoVersao: versao.numero, condicoesComerciais: versao.condicoes as Prisma.InputJsonValue,
        itens: { create: itens.map((i) => ({ produtoId: i.produtoId, varianteId: i.varianteId, nome: i.nome, sku: i.sku, quantidade: i.quantidade, precoUnitarioCentavos: i.precoUnitarioCentavos })) },
      }, include: { itens: true } });
      await tx.cotacaoB2B.update({ where: { id }, data: { estado: proximoEstadoCotacao(atual.estado, "CONVERTER"), pedidoId: pedido.id, chaveConversao: chave.trim() } });
      await tx.eventoCotacaoB2B.create({ data: evento(tenantId, id, "CONVERTIDA", ator, { pedidoId: pedido.id, chave: chave.trim() }) });
      return pedido;
    });
  } catch (erro) {
    const repetida = await prisma.cotacaoB2B.findFirst({ where: { tenantId, id }, include: { pedido: { include: { itens: true } } } });
    if (repetida?.pedido) return prisma.pedido.findUniqueOrThrow({ where: { id: repetida.pedido.id }, include: { itens: true } });
    throw erro;
  }
}

export async function recomprarCotacaoB2B(tenantId: string, id: string, validaAte: Date, ator: AtorCotacaoB2B) {
  const anterior = await obterCotacaoB2B(tenantId, id);
  if (anterior.estado !== "CONVERTIDA" || !anterior.pedidoId) throw new Error("Recompra exige uma cotação convertida em pedido.");
  const versao = anterior.versoes.find((v) => v.numero === (anterior.versaoAprovada ?? anterior.versaoAtual))!;
  const itens = versao.itens as unknown as ItemCotacaoB2B[];
  return criarCotacaoB2B(tenantId, { empresaId: anterior.empresaId, unidadeId: anterior.unidadeId, compradorEmpresaId: anterior.compradorEmpresaId, centroCustoId: anterior.centroCustoId, pedidoCompra: null, responsavelEmail: anterior.responsavelEmail, validaAte, itens: itens.map((i) => ({ produtoId: i.produtoId, varianteId: i.varianteId, quantidade: i.quantidade })), condicoes: versao.condicoes as Record<string, unknown> }, ator);
}
