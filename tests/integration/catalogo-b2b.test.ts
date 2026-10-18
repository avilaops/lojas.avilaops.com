import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { aprovarVersaoCatalogoB2B, obterCatalogoB2B, salvarCatalogoB2B } from "../../src/lib/catalogo-b2b";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());
const chave = () => randomUUID().replace(/-/g, "");

async function contexto() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-cat-b2b-${chave()}`, nome: "QA catálogo B2B", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente-a", razaoSocial: "Cliente A" } });
  const unidade = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" } });
  const produto = await prisma.produto.create({
    data: { tenantId: tenant.id, slug: `produto-${chave()}`, nome: "Produto A", sku: "SKU-A", precoCentavos: 1_000, variantes: { create: { padrao: true, valores: {}, nome: "Padrão", sku: "VAR-A", precoCentavos: 1_000 } } },
    include: { variantes: true },
  });
  return { tenant, empresa, unidade, produto, variante: produto.variantes[0] };
}

function entrada(precoFixoCentavos = 900) {
  return {
    referencia: "tabela-a",
    nome: "Tabela A",
    versao: 1,
    moeda: "BRL" as const,
    vigenteDesde: new Date("2026-10-18T00:00:00.000Z"),
    vigenteAte: null,
    atribuicoes: [{ empresaReferencia: "cliente-a", unidadeReferencia: "matriz", prioridade: 10 }],
    itens: [{
      produtoReferencia: "SKU-A",
      varianteReferencia: "VAR-A",
      acao: "INCLUIR" as const,
      estrategiaPreco: "FIXO" as const,
      precoFixoCentavos,
      quantidadeMinima: 1,
      quantidadeMaxima: null,
      multiploVenda: 1,
      quantidadePorEmbalagem: 1,
      unidadeComercial: "UN",
      unidadesBaseNumerador: 1,
      unidadesBaseDenominador: 1,
      componentes: [] as Array<{ varianteReferencia: string; quantidadeBaseNumerador: number; quantidadeBaseDenominador: number }>,
    }],
  };
}

test("cria, repete sem duplicar e substitui o snapshot rascunho", async () => {
  const { tenant, produto, variante } = await contexto();
  const primeira = await salvarCatalogoB2B(tenant.id, entrada());
  const repetida = await salvarCatalogoB2B(tenant.id, entrada());
  const alterada = await salvarCatalogoB2B(tenant.id, entrada(850));

  assert.equal(repetida.id, primeira.id);
  assert.equal(alterada.id, primeira.id);
  assert.equal(await prisma.catalogoB2B.count({ where: { tenantId: tenant.id } }), 1);
  assert.equal(await prisma.versaoCatalogoB2B.count({ where: { tenantId: tenant.id } }), 1);
  const lido = await obterCatalogoB2B(tenant.id, primeira.id);
  assert.equal(lido.versoes[0].itens[0].precoFixoCentavos, 850);
  assert.equal(lido.versoes[0].itens[0].produtoId, produto.id);
  assert.equal(lido.versoes[0].itens[0].varianteId, variante.id);
});

test("aprovação calcula hash, audita uma vez e torna o snapshot imutável", async () => {
  const { tenant } = await contexto();
  const catalogo = await salvarCatalogoB2B(tenant.id, entrada());
  const aprovada = await aprovarVersaoCatalogoB2B(tenant.id, catalogo.id, 1, "qa@avilaops.com");
  const retry = await aprovarVersaoCatalogoB2B(tenant.id, catalogo.id, 1, "qa@avilaops.com");

  assert.equal(aprovada.estado, "APROVADA");
  assert.match(aprovada.conteudoHash ?? "", /^[0-9a-f]{64}$/);
  assert.equal(retry.conteudoHash, aprovada.conteudoHash);
  assert.equal(await prisma.auditoriaCatalogoB2B.count({ where: { tenantId: tenant.id, versaoId: aprovada.id } }), 1);
  await assert.rejects(() => salvarCatalogoB2B(tenant.id, entrada(700)), /aprovada/i);
  await assert.rejects(() => prisma.itemCatalogoB2B.deleteMany({ where: { tenantId: tenant.id, versaoId: aprovada.id } }), /imutável/i);
});

test("aprovações concorrentes convergem para a mesma versão e uma auditoria", async () => {
  const { tenant } = await contexto();
  const catalogo = await salvarCatalogoB2B(tenant.id, entrada());

  const [primeira, segunda] = await Promise.all([
    aprovarVersaoCatalogoB2B(tenant.id, catalogo.id, 1, "qa-1@avilaops.com"),
    aprovarVersaoCatalogoB2B(tenant.id, catalogo.id, 1, "qa-2@avilaops.com"),
  ]);

  assert.equal(primeira.estado, "APROVADA");
  assert.equal(segunda.estado, "APROVADA");
  assert.equal(segunda.conteudoHash, primeira.conteudoHash);
  assert.equal(await prisma.auditoriaCatalogoB2B.count({ where: { tenantId: tenant.id, versaoId: primeira.id } }), 1);
});

test("recusa referência que não pertence ao tenant ou à empresa", async () => {
  const a = await contexto();
  const b = await contexto();
  await assert.rejects(() => salvarCatalogoB2B(a.tenant.id, { ...entrada(), atribuicoes: [{ empresaReferencia: "empresa-de-outro-tenant", unidadeReferencia: b.unidade.referencia, prioridade: 0 }] }), /empresa/i);
  await assert.rejects(() => salvarCatalogoB2B(a.tenant.id, { ...entrada(), itens: [{ ...entrada().itens[0], produtoReferencia: b.produto.id }] }), /produto/i);
});
