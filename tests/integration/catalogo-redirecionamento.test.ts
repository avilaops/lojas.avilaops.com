import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { destinoDoProdutoArquivado } from "../../src/lib/catalogo-redirecionamento";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

test("link arquivado acompanha a variante movida e mantém o volume selecionado", async () => {
  const t = await prisma.tenant.create({ data: { slug: `links-${randomUUID()}`, nome: "QA links", status: "ATIVA" } });
  try {
    const origem = await salvarProdutoNoCatalogo(t.id, null, { nome: "Frasco 35 mL", slug: "frasco-35", sku: "FR35", precoCentavos: 692 });
    const destino = await salvarProdutoNoCatalogo(t.id, null, { nome: "Frasco", slug: "frasco", sku: "FR100", precoCentavos: 1399 });
    const v = await prisma.variante.findFirstOrThrow({ where: { tenantId: t.id, produtoId: origem.id } });
    assert.equal(await destinoDoProdutoArquivado(t.id, origem.slug), null);
    await prisma.produto.update({ where: { id: origem.id }, data: { ativo: false } });
    assert.equal(await destinoDoProdutoArquivado(t.id, origem.slug), null);
    await prisma.variante.update({ where: { id: v.id }, data: { produtoId: destino.id, padrao: false, nome: "35 mL", valores: { Volume: "35 mL" } } });
    assert.equal(await destinoDoProdutoArquivado(t.id, origem.slug), `/produtos/frasco?variante=${v.id}`);
    assert.equal(await destinoDoProdutoArquivado(t.id, "inexistente"), null);
    await prisma.variante.update({ where: { id: v.id }, data: { ativo: false } });
    assert.equal(await destinoDoProdutoArquivado(t.id, origem.slug), null);
    await prisma.variante.update({ where: { id: v.id }, data: { ativo: true } });
    await prisma.produto.update({ where: { id: destino.id }, data: { ativo: false } });
    assert.equal(await destinoDoProdutoArquivado(t.id, origem.slug), null);
  } finally {
    await prisma.tenant.delete({ where: { id: t.id } });
  }
});

test("redirecionamento respeita a loja e prioriza a equivalência declarada", async () => {
  const a = await prisma.tenant.create({ data: { slug: `links-${randomUUID()}`, nome: "QA A", status: "ATIVA" } });
  const b = await prisma.tenant.create({ data: { slug: `links-${randomUUID()}`, nome: "QA B", status: "ATIVA" } });
  try {
    const origem = await salvarProdutoNoCatalogo(a.id, null, { nome: "Antigo", slug: "antigo", sku: "ORIGEM", ativo: false });
    await salvarProdutoNoCatalogo(b.id, null, { nome: "Outra loja", slug: "outra-loja", sku: "ORIGEM" });
    assert.equal(await destinoDoProdutoArquivado(a.id, origem.slug), null);
    assert.equal(await destinoDoProdutoArquivado(b.id, origem.slug), null);
    const destino = await salvarProdutoNoCatalogo(a.id, null, { nome: "Declarado", slug: "declarado", sku: "ALVO" });
    const v = await prisma.variante.findFirstOrThrow({ where: { tenantId: a.id, produtoId: origem.id } });
    await prisma.variante.update({ where: { id: v.id }, data: { produtoId: destino.id, padrao: false } });
    await prisma.produto.update({ where: { id: origem.id }, data: { atributos: { equivalenteA: " ALVO " } } });
    assert.equal(await destinoDoProdutoArquivado(a.id, origem.slug), "/produtos/declarado");
    await prisma.produto.update({ where: { id: origem.id }, data: { atributos: { equivalenteA: "AUSENTE" } } });
    assert.equal(await destinoDoProdutoArquivado(a.id, origem.slug), null);
    await prisma.produto.update({ where: { id: origem.id }, data: { atributos: { equivalenteA: "ALVO" } } });
    await prisma.produto.update({ where: { id: destino.id }, data: { ativo: false } });
    assert.equal(await destinoDoProdutoArquivado(a.id, origem.slug), null);
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});
