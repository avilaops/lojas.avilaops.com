import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { GET } from "../../src/app/api/admin/tenants/[slug]/catalogo/qualidade/route";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import type { RelatorioGovernancaCatalogo } from "../../src/lib/catalogo-governanca";
import { INCLUIR_CATALOGO } from "../../src/lib/catalogo-qualidade";
import { prisma } from "../../src/lib/db";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}

delete process.env.N8N_WEBHOOK_URL;
process.env.LOJAS_ADMIN_TOKEN = "token-de-teste-governanca";
const tenantIds: string[] = [];
after(async () => {
  try {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function loja() {
  const tenant = await prisma.tenant.create({
    data: { slug: `qa-governanca-${randomUUID()}`, nome: "QA Governança", status: "ATIVA" },
  });
  tenantIds.push(tenant.id);
  const categoria = await prisma.categoria.create({
    data: { tenantId: tenant.id, slug: "retentores", nome: "Retentores" },
  });
  return { ...tenant, categoriaId: categoria.id };
}

async function produto(tenant: Awaited<ReturnType<typeof loja>>, sku: string, precoCentavos = 1000) {
  return salvarProdutoNoCatalogo(tenant.id, null, {
    nome: "Retentor industrial", slug: `retentor-${randomUUID()}`, sku, precoCentavos,
    marca: "Sabó", categoriaId: tenant.categoriaId, ncm: "40169300", estoque: 4,
    descricao: "Retentor para vedação industrial.", imagens: ["https://example.com/retentor.webp"],
    atributos: { unidade: "UN", diametroInternoMm: 20, diametroExternoMm: 35, alturaMm: 7 },
  }, { origem: "importacao" });
}

function consultar(slug: string, token = "token-de-teste-governanca") {
  return GET(new Request(`https://lojas.example/api/admin/tenants/${slug}/catalogo/qualidade`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }), { params: Promise.resolve({ slug }) });
}

test("qualidade exige autenticação antes de revelar se a loja existe", async () => {
  for (const token of ["", "errado"]) {
    const resposta = await consultar("loja-inexistente", token);
    assert.equal(resposta.status, 401);
    assert.deepEqual(await resposta.json(), { erro: "não autorizado" });
  }
  assert.equal((await consultar("loja-inexistente")).status, 404);
});

test("qualidade inclui mais de cem SKUs e não compara nem revela dados de outra loja", async () => {
  const a = await loja();
  const b = await loja();
  const ids: string[] = [];
  for (let i = 0; i < 101; i++) ids.push((await produto(a, `RET-${i}`)).id);
  await produto(b, "RET.0", 9900);

  const resposta = await consultar(a.slug);
  assert.equal(resposta.status, 200);
  const relatorio = await resposta.json() as RelatorioGovernancaCatalogo;
  assert.equal(relatorio.resumo.produtos, 101);
  assert.equal(relatorio.resumo.skus, 101);
  assert.equal(relatorio.resumo.camposObrigatorios, 1111);
  assert.equal(relatorio.resumo.camposPreenchidos, 1111);
  assert.equal(relatorio.resumo.coberturaPercentual, 100);
  assert.equal(relatorio.resumo.duplicidades, 0);
  assert.equal(relatorio.resumo.conflitosPreco, 0);
  assert.deepEqual(relatorio.linhas.map((linha) => linha.produtoId).sort(), ids.sort());
  assert.deepEqual(relatorio.coberturaPorCampo.medidas, { preenchidos: 101, total: 101, percentual: 100 });
  assert.equal((await (await consultar(b.slug)).json() as RelatorioGovernancaCatalogo).resumo.skus, 1);
});

test("qualidade alerta duplicidade e conflito de preço sem escrever no catálogo", async () => {
  const t = await loja();
  await produto(t, "RET-001", 1000);
  await produto(t, "ret.001", 1250);
  const snapshot = async () => ({
    produtos: await prisma.produto.findMany({
      where: { tenantId: t.id }, include: INCLUIR_CATALOGO, orderBy: { id: "asc" },
    }),
    historico: await prisma.historicoCatalogo.count({ where: { tenantId: t.id } }),
    eventos: await prisma.eventoCatalogo.count({ where: { tenantId: t.id } }),
    movimentos: await prisma.movimentoEstoque.count({ where: { tenantId: t.id } }),
  });
  const antes = await snapshot();

  const resposta = await consultar(t.slug);
  assert.equal(resposta.status, 200);
  const relatorio = await resposta.json() as RelatorioGovernancaCatalogo;
  assert.equal(relatorio.resumo.duplicidades, 1);
  assert.equal(relatorio.resumo.conflitosPreco, 1);
  assert.equal(relatorio.resumo.bloqueados, 2);
  assert.deepEqual(relatorio.conflitos[0].precosCentavos, [1000, 1250]);
  assert.ok(relatorio.linhas.every((linha) => linha.ocorrencias.some((o) => o.regra === "sku_duplicado")));
  assert.deepEqual(await snapshot(), antes);
});
