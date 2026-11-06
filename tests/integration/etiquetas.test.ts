import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo, salvarGradeNoCatalogo } from "../../src/lib/catalogo-escrita";
import { consultarEtiquetas } from "../../src/lib/etiquetas-catalogo";
import { ConsultaEtiquetas } from "../../src/lib/etiquetas";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(() => prisma.$disconnect());

test("etiquetas isolam tenant, resolvem variante exata e preservam código após edição", async () => {
  const a = await prisma.tenant.create({ data: { slug: `etiquetas-${randomUUID()}`, nome: "QA etiquetas A", status: "ATIVA" } });
  const b = await prisma.tenant.create({ data: { slug: `etiquetas-${randomUUID()}`, nome: "QA etiquetas B", status: "ATIVA" } });
  try {
    const p = await salvarProdutoNoCatalogo(a.id, null, { nome: "Camiseta QA", slug: "camiseta", precoCentavos: 1000, gtin: "036000291452" });
    const consulta = ConsultaEtiquetas.parse({ produtoId: p.id });
    const inicial = await consultarEtiquetas(a.id, consulta);
    assert.equal(inicial.itens.length, 1);
    const codigo = inicial.itens[0].codigo!;
    assert.ok(inicial.itens[0].svg);
    assert.equal((await consultarEtiquetas(b.id, consulta)).total, 0);
    assert.equal((await consultarEtiquetas(b.id, ConsultaEtiquetas.parse({ q: codigo }))).total, 0);
    await salvarProdutoNoCatalogo(a.id, p.id, { nome: "Camiseta renomeada", precoCentavos: 1500 });
    const alterado = await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ q: codigo }));
    assert.equal(alterado.itens[0].codigo, codigo);
    assert.equal(alterado.itens[0].precoCentavos, 1500);
    const gtin = await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ q: "036000291452", tipo: "gtin" }));
    assert.equal(gtin.itens[0].codigo, "036000291452");
    assert.equal(gtin.itens[0].erro, null);

    const grade = await salvarGradeNoCatalogo(a.id, p.id, ["Tamanho"], [
      { valores: { Tamanho: "P" }, sku: "CAM-P", precoCentavos: 2000 },
      { valores: { Tamanho: "G" }, sku: "CAM-G", precoCentavos: 2500 },
    ]);
    const itens = (await consultarEtiquetas(a.id, consulta)).itens;
    assert.equal(itens.length, 2);
    assert.notEqual(itens[0].codigo, itens[1].codigo);
    assert.equal((await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ q: itens[1].codigo! }))).itens[0].id, itens[1].id);
    assert.equal((await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ q: "CAM-G" }))).itens[0].variacao, "G");
    assert.equal((await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ q: codigo }))).total, 0);
    assert.equal((await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ produtoId: p.id, tipo: "gtin" }))).itens.every(i => i.erro && !i.svg), true);
    await prisma.variante.update({ where: { id: grade.variantes[0].id }, data: { ativo: false } });
    assert.equal((await consultarEtiquetas(a.id, consulta)).total, 1);
  } finally {
    await prisma.movimentoEstoque.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});

test("GTIN repetido é bloqueado na loja, sem bloquear outra loja; inativo não imprime", async () => {
  const a = await prisma.tenant.create({ data: { slug: `etiquetas-${randomUUID()}`, nome: "QA duplicidade", status: "ATIVA" } });
  const b = await prisma.tenant.create({ data: { slug: `etiquetas-${randomUUID()}`, nome: "QA independente", status: "ATIVA" } });
  try {
    const criar = (tenantId: string, slug: string, gtin: string) => salvarProdutoNoCatalogo(tenantId, null, { nome: slug, slug, precoCentavos: 1000, gtin });
    const p = await criar(a.id, "primeiro", "7898511024485");
    await criar(a.id, "segundo", "7898511024485");
    await criar(b.id, "terceiro", "7898511024485");
    await criar(a.id, "invalido", "7898511024486");
    const consulta = ConsultaEtiquetas.parse({ tipo: "gtin", q: "7898511024485" });
    const duplicados = await consultarEtiquetas(a.id, consulta);
    assert.equal(duplicados.total, 2);
    assert.ok(duplicados.itens.every(i => i.erro?.includes("mais de um") && !i.svg));
    assert.equal((await consultarEtiquetas(b.id, consulta)).itens[0].erro, null);
    assert.ok((await consultarEtiquetas(a.id, ConsultaEtiquetas.parse({ tipo: "gtin", q: "7898511024486" }))).itens[0].erro);
    await salvarProdutoNoCatalogo(a.id, p.id, { ativo: false });
    assert.equal((await consultarEtiquetas(a.id, consulta)).total, 1);
    assert.equal((await consultarEtiquetas(a.id, consulta)).itens[0].erro, null);
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});
