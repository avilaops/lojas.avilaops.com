import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { aprovarVersaoCatalogoB2B, resolverCatalogoB2B, salvarCatalogoB2B } from "../../src/lib/catalogo-b2b";
import type { EntradaCatalogoB2B } from "../../src/lib/catalogo-b2b-schema";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(() => prisma.$disconnect());
const chave = () => randomUUID().replace(/-/g, "");

async function contexto() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-resolve-${chave()}`, nome: "QA resolução", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Cliente" } });
  const unidade = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" } });
  const produto = await prisma.produto.create({
    data: { tenantId: tenant.id, slug: `produto-${chave()}`, nome: "Rolamento", marca: "Marca", sku: "PROD", ncm: "84821010", cest: "0100100", precoCentavos: 1_001, variantes: { create: { padrao: true, valores: {}, nome: "Padrão", sku: "VAR", precoCentavos: 1_001, estoque: 10, saldos: { create: { local: "principal", fisico: 10 } } } } },
    include: { variantes: { include: { saldos: true } } },
  });
  return { tenant, empresa, unidade, produto, variante: produto.variantes[0] };
}

function entrada(vigenteDesde: Date, vigenteAte: Date | null = null): EntradaCatalogoB2B {
  return {
    referencia: `tabela-${chave()}`, nome: "Tabela", versao: 1, moeda: "BRL" as const, vigenteDesde, vigenteAte,
    atribuicoes: [{ empresaReferencia: "cliente", unidadeReferencia: null, prioridade: 0 }],
    itens: [{ produtoReferencia: "PROD", varianteReferencia: "VAR", acao: "INCLUIR" as const, estrategiaPreco: "DESCONTO" as const, descontoPontosBase: 2_500, quantidadeMinima: 1, quantidadeMaxima: null, multiploVenda: 1, quantidadePorEmbalagem: 1, unidadeComercial: "UN", unidadesBaseNumerador: 1, unidadesBaseDenominador: 1, componentes: [] }],
  };
}

test("resolve versão aprovada vigente por empresa/unidade e preserva metadados mestres", async () => {
  const c = await contexto();
  const catalogo = await salvarCatalogoB2B(c.tenant.id, entrada(new Date("2026-10-01")));
  await aprovarVersaoCatalogoB2B(c.tenant.id, catalogo.id, 1, "qa");
  const resultado = await resolverCatalogoB2B(c.tenant.id, { empresaId: c.empresa.id, unidadeId: c.unidade.id, produtoId: c.produto.id, varianteId: c.variante.id, quantidade: 2, agora: new Date("2026-10-18") });

  assert.equal(resultado.oferta.tipo, "OFERTA_B2B");
  assert.deepEqual(resultado.oferta.tipo === "OFERTA_B2B" ? [resultado.oferta.precoUnitarioCentavos, resultado.oferta.totalCentavos] : null, [751, 1502]);
  assert.deepEqual({ sku: resultado.produto.sku, marca: resultado.produto.marca, ncm: resultado.produto.ncm, cest: resultado.produto.cest }, { sku: "PROD", marca: "Marca", ncm: "84821010", cest: "0100100" });
});

test("versão futura ou expirada cai no preço público B2C", async () => {
  const c = await contexto();
  for (const [desde, ate] of [[new Date("2026-11-01"), null], [new Date("2026-09-01"), new Date("2026-10-01")]] as const) {
    const catalogo = await salvarCatalogoB2B(c.tenant.id, entrada(desde, ate));
    await aprovarVersaoCatalogoB2B(c.tenant.id, catalogo.id, 1, "qa");
  }
  const resultado = await resolverCatalogoB2B(c.tenant.id, { empresaId: c.empresa.id, unidadeId: null, produtoId: c.produto.id, varianteId: c.variante.id, quantidade: 2, agora: new Date("2026-10-18") });
  assert.deepEqual(resultado.oferta, { tipo: "OFERTA_PUBLICA", precoUnitarioCentavos: 1001, totalCentavos: 2002 });
});

test("variante, exclusão e kit são resolvidos sem mutar SaldoEstoque", async () => {
  const c = await contexto();
  const antes = await prisma.saldoEstoque.findMany({ where: { tenantId: c.tenant.id }, orderBy: { id: "asc" } });
  const e = entrada(new Date("2026-10-01"));
  e.itens[0].componentes = [{ varianteReferencia: "VAR", quantidadeBaseNumerador: 3, quantidadeBaseDenominador: 2 }];
  const catalogo = await salvarCatalogoB2B(c.tenant.id, e);
  await aprovarVersaoCatalogoB2B(c.tenant.id, catalogo.id, 1, "qa");
  const resultado = await resolverCatalogoB2B(c.tenant.id, { empresaId: c.empresa.id, unidadeId: null, produtoId: c.produto.id, varianteId: c.variante.id, quantidade: 2, agora: new Date("2026-10-18") });
  const exclusao: EntradaCatalogoB2B = {
    ...entrada(new Date("2026-10-01")),
    referencia: `bloqueio-${chave()}`,
    atribuicoes: [{ empresaReferencia: "cliente", unidadeReferencia: null, prioridade: 100 }],
    itens: [{
      produtoReferencia: "PROD", varianteReferencia: "VAR", acao: "EXCLUIR",
      quantidadeMinima: 1, quantidadeMaxima: null, multiploVenda: 1,
      quantidadePorEmbalagem: 1, unidadeComercial: "UN",
      unidadesBaseNumerador: 1, unidadesBaseDenominador: 1, componentes: [],
    }],
  };
  const catalogoExclusao = await salvarCatalogoB2B(c.tenant.id, exclusao);
  await aprovarVersaoCatalogoB2B(c.tenant.id, catalogoExclusao.id, 1, "qa");
  const bloqueado = await resolverCatalogoB2B(c.tenant.id, { empresaId: c.empresa.id, unidadeId: null, produtoId: c.produto.id, varianteId: c.variante.id, quantidade: 2, agora: new Date("2026-10-18") });
  const depois = await prisma.saldoEstoque.findMany({ where: { tenantId: c.tenant.id }, orderBy: { id: "asc" } });
  assert.deepEqual(resultado.oferta.tipo === "OFERTA_B2B" ? resultado.oferta.componentes : null, [{ varianteId: c.variante.id, quantidadeBaseNumerador: 3, quantidadeBaseDenominador: 1 }]);
  assert.equal(bloqueado.oferta.tipo === "INDISPONIVEL" ? bloqueado.oferta.motivo : null, "EXCLUIDO");
  assert.deepEqual(depois, antes);
});
