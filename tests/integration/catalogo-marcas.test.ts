import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { marcasDoCatalogo } from "../../src/lib/catalogo-marcas";
import { condicaoDoCatalogo, filtroDaUrl } from "../../src/lib/catalogo-filtros";
import { produtosEmLinhas } from "../../src/lib/exportar";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

test("marca filtra catálogo e planilha por tenant, junto de busca, categoria e pendência", async () => {
  const a = await prisma.tenant.create({ data: { slug: `marcas-${randomUUID()}`, nome: "QA A", status: "ATIVA" } });
  const b = await prisma.tenant.create({ data: { slug: `marcas-${randomUUID()}`, nome: "QA B", status: "ATIVA" } });
  try {
    const categoria = await prisma.categoria.create({ data: { tenantId: a.id, slug: "porcas", nome: "Porcas" } });
    const criar = (tenantId: string, slug: string, marca: string | null, estoque = 0, categoriaId?: string) => salvarProdutoNoCatalogo(tenantId, null, {
      nome: `Peça ${slug}`, slug, marca, estoque, categoriaId, sku: slug, precoCentavos: 1000,
    });
    await criar(a.id, "km09", "BGL", 0, categoria.id);
    await criar(a.id, "km12", "BGL", 5, categoria.id);
    await criar(a.id, "km14", "BGL Industrial", 0, categoria.id);
    await criar(a.id, "outro", "SKF");
    await criar(a.id, "sem-marca", null);
    await criar(a.id, "diversos", "DIVERSOS");
    await criar(b.id, "outra-loja", "Exclusiva");

    assert.deepEqual(await marcasDoCatalogo(a.id), ["BGL", "BGL Industrial", "SKF"]);
    const filtro = filtroDaUrl(new URL("https://loja.test/api/painel/catalogo?marca=bgl&categoria=porcas&q=pe%C3%A7a&situacao=esgotado"));
    const encontrados = await prisma.produto.findMany({ where: condicaoDoCatalogo(a.id, filtro) });
    assert.deepEqual(encontrados.map((p) => p.slug), ["km09"]);
    const planilha = await produtosEmLinhas(a.id, filtro);
    assert.equal(planilha.length, 2);
    assert.ok(planilha[1].includes("km09"));
    assert.equal(await prisma.produto.count({ where: condicaoDoCatalogo(b.id, filtro) }), 0);
    assert.equal(await prisma.produto.count({ where: condicaoDoCatalogo(a.id, { marca: "BGL" }) }), 2);
    assert.ok(await prisma.produto.count({ where: condicaoDoCatalogo(a.id, { busca: "bgl" }) }) >= 3);
  } finally {
    await prisma.movimentoEstoque.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});
