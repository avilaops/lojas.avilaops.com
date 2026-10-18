import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}

after(() => prisma.$disconnect());
const chave = () => randomUUID().replace(/-/g, "");

async function loja(nome: string) {
  return prisma.tenant.create({ data: { slug: `qa-b2b-${chave()}`, nome, status: "ATIVA" } });
}

async function produto(tenantId: string, nome: string) {
  return prisma.produto.create({
    data: {
      tenantId,
      slug: `produto-${chave()}`,
      nome,
      precoCentavos: 1_000,
      variantes: { create: { padrao: true, valores: {}, nome: "Padrão", precoCentavos: 1_000 } },
    },
    include: { variantes: true },
  });
}

async function empresa(tenantId: string, nome: string) {
  return prisma.empresaB2B.create({ data: { tenantId, referencia: `EMP-${chave()}`, razaoSocial: nome } });
}

test("catálogo B2B preserva tenant, empresa, produto e variante em chaves compostas", async () => {
  const [tenantA, tenantB] = await Promise.all([loja("Loja A"), loja("Loja B")]);
  const [empresaA, empresaB] = await Promise.all([empresa(tenantA.id, "Empresa A"), empresa(tenantB.id, "Empresa B")]);
  const empresaA2 = await empresa(tenantA.id, "Empresa A2");
  const unidadeA = await prisma.unidadeEmpresaB2B.create({
    data: { tenantId: tenantA.id, empresaId: empresaA.id, referencia: `UNI-${chave()}`, nome: "Unidade A", cnpj: "11222333000181" },
  });
  const unidadeA2 = await prisma.unidadeEmpresaB2B.create({
    data: { tenantId: tenantA.id, empresaId: empresaA2.id, referencia: `UNI-${chave()}`, nome: "Unidade A2", cnpj: "11444777000161" },
  });
  const [produtoA, produtoB] = await Promise.all([produto(tenantA.id, "Produto A"), produto(tenantB.id, "Produto B")]);
  const produtoA2 = await produto(tenantA.id, "Produto A2");

  const catalogo = await prisma.catalogoB2B.create({
    data: {
      tenantId: tenantA.id,
      referencia: `CAT-${chave()}`,
      nome: "Contrato A",
      versoes: {
        create: {
          versao: 1,
          vigenteDesde: new Date("2026-10-18T00:00:00.000Z"),
          atribuicoes: { create: { empresaId: empresaA.id, unidadeId: unidadeA.id, prioridade: 10 } },
          itens: {
            create: {
              produtoId: produtoA.id,
              varianteId: produtoA.variantes[0].id,
              acao: "INCLUIR",
              estrategiaPreco: "FIXO",
              precoFixoCentavos: 900,
              quantidadeMinima: 1,
              multiploVenda: 1,
              quantidadePorEmbalagem: 1,
              unidadeComercial: "UN",
              unidadesBaseNumerador: 1,
              unidadesBaseDenominador: 1,
            },
          },
        },
      },
    },
    include: { versoes: { include: { atribuicoes: true, itens: true } } },
  });
  assert.equal(catalogo.versoes[0].atribuicoes[0].unidadeId, unidadeA.id);
  assert.equal(catalogo.versoes[0].itens[0].varianteId, produtoA.variantes[0].id);

  const versaoId = catalogo.versoes[0].id;
  await assert.rejects(() => prisma.atribuicaoCatalogoB2B.create({
    data: { tenantId: tenantA.id, versaoId, empresaId: empresaB.id, prioridade: 0 },
  }));
  await assert.rejects(() => prisma.atribuicaoCatalogoB2B.create({
    data: { tenantId: tenantA.id, versaoId, empresaId: empresaB.id, unidadeId: unidadeA.id, prioridade: 0 },
  }));
  await assert.rejects(() => prisma.atribuicaoCatalogoB2B.create({
    data: { tenantId: tenantA.id, versaoId, empresaId: empresaA.id, unidadeId: unidadeA2.id, prioridade: 0 },
  }));
  await assert.rejects(() => prisma.itemCatalogoB2B.create({
    data: {
      tenantId: tenantA.id,
      versaoId,
      produtoId: produtoB.id,
      varianteId: produtoB.variantes[0].id,
      acao: "INCLUIR",
      estrategiaPreco: "FIXO",
      precoFixoCentavos: 100,
      quantidadeMinima: 1,
      multiploVenda: 1,
      quantidadePorEmbalagem: 1,
      unidadeComercial: "UN",
      unidadesBaseNumerador: 1,
      unidadesBaseDenominador: 1,
    },
  }));
  await assert.rejects(() => prisma.itemCatalogoB2B.create({
    data: {
      tenantId: tenantA.id,
      versaoId,
      produtoId: produtoA.id,
      varianteId: produtoA2.variantes[0].id,
      acao: "INCLUIR",
      estrategiaPreco: "FIXO",
      precoFixoCentavos: 100,
      quantidadeMinima: 1,
      multiploVenda: 1,
      quantidadePorEmbalagem: 1,
      unidadeComercial: "UN",
      unidadesBaseNumerador: 1,
      unidadesBaseDenominador: 1,
    },
  }));
});

test("versão aprovada e auditoria são append-only no banco", async () => {
  const tenant = await loja("Loja imutável");
  const produtoRascunho = await produto(tenant.id, "Produto do rascunho");
  const catalogo = await prisma.catalogoB2B.create({
    data: {
      tenantId: tenant.id,
      referencia: `CAT-${chave()}`,
      nome: "Imutável",
      versoes: {
        create: {
          versao: 1,
          estado: "APROVADA",
          vigenteDesde: new Date("2026-10-18T00:00:00.000Z"),
          aprovadoEm: new Date(),
          aprovadoPor: "qa@example.test",
          conteudoHash: "a".repeat(64),
        },
      },
    },
    include: { versoes: true },
  });
  const versao = catalogo.versoes[0];
  await assert.rejects(() => prisma.versaoCatalogoB2B.update({ where: { id: versao.id }, data: { vigenteAte: new Date("2026-11-01") } }), /imutável/i);

  const rascunho = await prisma.versaoCatalogoB2B.create({
    data: { tenantId: tenant.id, catalogoId: catalogo.id, versao: 2, vigenteDesde: new Date("2026-11-01T00:00:00.000Z") },
  });
  const itemRascunho = await prisma.itemCatalogoB2B.create({
    data: {
      tenantId: tenant.id,
      versaoId: rascunho.id,
      produtoId: produtoRascunho.id,
      varianteId: produtoRascunho.variantes[0].id,
      acao: "INCLUIR",
      estrategiaPreco: "FIXO",
      precoFixoCentavos: 900,
      quantidadeMinima: 1,
      multiploVenda: 1,
      quantidadePorEmbalagem: 1,
      unidadeComercial: "UN",
      unidadesBaseNumerador: 1,
      unidadesBaseDenominador: 1,
    },
  });
  await assert.rejects(
    () => prisma.itemCatalogoB2B.update({ where: { id: itemRascunho.id }, data: { versaoId: versao.id } }),
    /imutável/i,
  );

  const auditoria = await prisma.auditoriaCatalogoB2B.create({
    data: { tenantId: tenant.id, catalogoId: catalogo.id, versaoId: versao.id, acao: "APROVADA", ator: "qa@example.test", conteudoHash: "a".repeat(64) },
  });
  await assert.rejects(() => prisma.auditoriaCatalogoB2B.delete({ where: { id: auditoria.id } }), /append-only/i);
});
