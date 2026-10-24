import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { consultarRecompra } from "../../src/lib/recompra-consulta";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(() => prisma.$disconnect());

test("recompra isola conta/loja, atualiza preço, recusa estoque insuficiente e não cria pedido", async () => {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-recompra-${randomUUID()}`, nome: "QA", status: "ATIVA" } });
  const comprador = await prisma.comprador.create({ data: { tenantId: tenant.id, email: "qa@example.test", senhaHash: "hash", nome: "QA" } });
  const produto = await salvarProdutoNoCatalogo(tenant.id, null, { nome: "Peça QA", slug: "peca-qa", sku: "PEC-A", precoCentavos: 2000, estoque: 5 });
  const variante = await prisma.variante.findFirstOrThrow({ where: { tenantId: tenant.id, produtoId: produto.id, padrao: true } });
  const pedido = await prisma.pedido.create({ data: {
    tenantId: tenant.id, compradorId: comprador.id, referencia: randomUUID(), clienteNome: "QA", clienteEmail: comprador.email, clienteTelefone: "", clienteDocumento: "",
    freteNome: "Retirada", freteCentavos: 0, subtotalCentavos: 1000, totalCentavos: 1000, meioPagamento: "pix",
    itens: { create: [{ produtoId: produto.id, varianteId: variante.id, nome: "Peça antiga", sku: "PEC-A", quantidade: 2, precoUnitarioCentavos: 500 }] },
  } });
  assert.equal(await consultarRecompra("outra-loja", comprador.id, pedido.id), null);
  assert.equal(await consultarRecompra(tenant.id, "outro-comprador", pedido.id), null);
  const revisao = await consultarRecompra(tenant.id, comprador.id, pedido.id);
  assert.ok(revisao && !("erro" in revisao));
  assert.equal(revisao.itens[0].oferta?.precoCentavos, 2000);
  assert.equal(revisao.itens[0].precoAnteriorCentavos, 500);
  await salvarProdutoNoCatalogo(tenant.id, produto.id, { estoque: 1 });
  const semSaldo = await consultarRecompra(tenant.id, comprador.id, pedido.id);
  assert.ok(semSaldo && !("erro" in semSaldo));
  assert.equal(semSaldo.itens[0].oferta, null);
  assert.equal(await prisma.pedido.count({ where: { tenantId: tenant.id } }), 1);
  assert.equal((await prisma.pedidoItem.findFirstOrThrow({ where: { pedidoId: pedido.id } })).precoUnitarioCentavos, 500);
  await prisma.pedido.update({ where: { id: pedido.id }, data: { cotacaoVersao: 1 } });
  const negociado = await consultarRecompra(tenant.id, comprador.id, pedido.id);
  assert.ok(negociado && "erro" in negociado);
});
