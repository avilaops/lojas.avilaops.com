import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ErroCotacaoB2B } from "./cotacoes-b2b-erros";

const Parametros = z.object({ pagina: z.coerce.number().int().min(1).max(100000).default(1), busca: z.string().trim().max(100).default(""), estado: z.enum(["RASCUNHO", "EM_NEGOCIACAO", "AGUARDANDO_APROVACAO", "APROVADA", "RECUSADA", "EXPIRADA", "CANCELADA", "CONVERTIDA"]).optional() });

async function filtroComprador(tenantId: string, compradorId: string): Promise<Prisma.CotacaoB2BWhereInput> {
  const escopos = await prisma.escopoCompradorB2B.findMany({
    where: { tenantId, compradorEmpresa: { compradorId, situacao: "ATIVO" } },
    select: { id: true, compradorEmpresaId: true, unidadeId: true },
  });
  return {
    tenantId,
    compradorEmpresa: { compradorId, situacao: "ATIVO" },
    AND: [{ OR: escopos.map(escopo => ({
      compradorEmpresaId: escopo.compradorEmpresaId,
      ...(escopo.unidadeId ? { unidadeId: escopo.unidadeId } : {}),
      // Revalidar o escopo no SELECT da cotação também cobre revogação entre as consultas.
      compradorEmpresa: { escopos: { some: { id: escopo.id, unidadeId: escopo.unidadeId } } },
    })) }],
  };
}

export async function verificarAcessoCotacaoComprador(tenantId: string, compradorId: string, cotacaoId: string) {
  const cotacao = await prisma.cotacaoB2B.findFirst({
    where: { ...await filtroComprador(tenantId, compradorId), id: cotacaoId },
    select: { compradorEmpresaId: true },
  });
  if (!cotacao?.compradorEmpresaId) throw new ErroCotacaoB2B("Cotação não encontrada.", 404);
  return { id: cotacao.compradorEmpresaId };
}

export async function listarCotacoesB2B(tenantId: string, search: URLSearchParams, compradorId?: string) {
  const parsed = Parametros.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new ErroCotacaoB2B("Filtros inválidos.");
  const { pagina, busca, estado } = parsed.data;
  const where: Prisma.CotacaoB2BWhereInput = { tenantId,
    ...(compradorId ? await filtroComprador(tenantId, compradorId) : {}),
    ...(estado ? { estado } : {}),
    ...(busca ? { OR: [{ referencia: { contains: busca, mode: "insensitive" } }, { empresa: { razaoSocial: { contains: busca, mode: "insensitive" } } }, { pedidoCompra: { contains: busca, mode: "insensitive" } }] } : {}) };
  const linhas = await prisma.cotacaoB2B.findMany({ where, include: {
    empresa: { select: { razaoSocial: true } }, versoes: { orderBy: { numero: "desc" }, take: 1 }, pedido: { select: { id: true, numero: true, status: true } },
  }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (pagina - 1) * 20, take: 21 });
  return { cotacoes: linhas.slice(0, 20), pagina, temProxima: linhas.length > 20 };
}

const Referencias = z.object({ tipo: z.enum(["empresas", "unidades", "compradores", "centros", "produtos"]), empresaId: z.string().optional(), busca: z.string().trim().max(100).default(""), pagina: z.coerce.number().int().min(1).max(100000).default(1) });
export async function referenciasCotacao(tenantId: string, search: URLSearchParams, compradorId?: string) {
  const parsed = Referencias.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new ErroCotacaoB2B("Consulta inválida.");
  const { tipo, busca, empresaId, pagina } = parsed.data;
  const page = { take: 21, skip: (pagina - 1) * 20 };
  const texto = { contains: busca, mode: "insensitive" as const };
  if (tipo === "empresas") {
    const rows = await prisma.empresaB2B.findMany({ where: { tenantId, situacao: "ATIVA",
      ...(compradorId ? { compradores: { some: { compradorId, situacao: "ATIVO" } } } : {}),
      OR: [{ razaoSocial: texto }, { referencia: texto }],
    }, select: { id: true, razaoSocial: true, referencia: true }, orderBy: [{ razaoSocial: "asc" }, { id: "asc" }], ...page });
    return { opcoes: rows.slice(0, 20).map(row => ({ id: row.id, nome: `${row.razaoSocial} · ${row.referencia}` })), pagina, temProxima: rows.length > 20 };
  }
  if (!empresaId) throw new ErroCotacaoB2B("Escolha a empresa antes de continuar.");
  const empresa = await prisma.empresaB2B.findFirst({ where: { tenantId, id: empresaId, situacao: "ATIVA",
    ...(compradorId ? { compradores: { some: { compradorId, situacao: "ATIVO" } } } : {}),
  }, select: { id: true } });
  if (!empresa) throw new ErroCotacaoB2B("Empresa não encontrada.", 404);
  const vinculos = compradorId ? await prisma.compradorEmpresaB2B.findMany({ where: { tenantId, empresaId, compradorId, situacao: "ATIVO" }, select: { id: true, escopos: { select: { unidadeId: true, papel: true } }, centrosCusto: { select: { centroCustoId: true } } } }) : [];
  const escopos = vinculos.flatMap(vinculo => vinculo.escopos);
  const todasUnidades = !compradorId || escopos.some(escopo => escopo.unidadeId === null);
  const base = { tenantId, empresaId };
  if (tipo === "unidades") {
    const rows = await prisma.unidadeEmpresaB2B.findMany({ where: { ...base, ativa: true, nome: texto, ...(!todasUnidades ? { id: { in: escopos.flatMap(escopo => escopo.unidadeId ? [escopo.unidadeId] : []) } } : {}) }, select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], ...page });
    return { opcoes: rows.slice(0, 20), pagina, temProxima: rows.length > 20 };
  }
  if (tipo === "compradores") {
    const rows = await prisma.compradorEmpresaB2B.findMany({ where: { ...base, situacao: "ATIVO", ...(compradorId ? { compradorId } : {}), OR: [{ nome: texto }, { emailNormalizado: texto }] }, select: { id: true, nome: true, emailNormalizado: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], ...page });
    return { opcoes: rows.slice(0, 20).map(row => ({ id: row.id, nome: `${row.nome} · ${row.emailNormalizado}` })), pagina, temProxima: rows.length > 20 };
  }
  if (tipo === "centros") {
    const todosCentros = !compradorId || escopos.some(escopo => escopo.papel === "ADMINISTRADOR" && escopo.unidadeId === null);
    const rows = await prisma.centroCustoB2B.findMany({ where: { ...base, ativo: true, nome: texto, ...(!todosCentros ? { id: { in: vinculos.flatMap(vinculo => vinculo.centrosCusto.map(centro => centro.centroCustoId)) } } : {}) }, select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], ...page });
    return { opcoes: rows.slice(0, 20), pagina, temProxima: rows.length > 20 };
  }
  const rows = await prisma.variante.findMany({ where: { tenantId, ativo: true, produto: { ativo: true }, OR: [{ sku: texto }, { nome: texto }, { produto: { nome: texto } }] }, select: { id: true, produtoId: true, nome: true, sku: true, produto: { select: { nome: true } } }, orderBy: [{ produtoId: "asc" }, { id: "asc" }], ...page });
  return { opcoes: rows.slice(0, 20).map(row => ({ id: row.id, produtoId: row.produtoId, nome: `${row.produto.nome} · ${row.nome}${row.sku ? ` · ${row.sku}` : ""}` })), pagina, temProxima: rows.length > 20 };
}
