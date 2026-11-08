import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { buscarProduto, listarProdutos } from "../../src/lib/catalogo";
import { registrarDemandaPk, relatorioDemandasPk, expurgarDemandasPk } from "../../src/lib/pk-demanda-consulta";
import { chaveDemandaPk } from "../../src/lib/pk-demanda-busca";
import { resolverCotacao } from "../../src/lib/pk-cotacao-lote";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(() => prisma.$disconnect());

test("PK: agregação PostgreSQL, retenção e leitura de catálogo respeitam tenant", async t => {
  const existente = await prisma.tenant.findUnique({ where: { slug: "pkvedacoes" } });
  const pk = existente ?? await prisma.tenant.create({ data: { slug: "pkvedacoes", nome: "QA PK", status: "ATIVA" } });
  const outra = await prisma.tenant.create({ data: { slug: `qa-pk-isolamento-${randomUUID()}`, nome: "QA outra loja", status: "ATIVA" } });
  const agora = new Date("2026-11-08T15:00:00.000Z");
  const hoje = new Date("2026-11-08T00:00:00.000Z");
  const dia = 86_400_000;
  const numero = 100_000 + Math.floor(Math.random() * 800_000);
  const codigo = `PK${numero}`;
  const consultas = new Set<string>([codigo]);
  const idsProdutos: string[] = [];
  const pedidosAntes = await prisma.pedido.count({ where: { tenantId: pk.id } });
  const criarProduto = async (tenantId: string, sku: string, ativo = true) => {
    const produto = await prisma.produto.create({ data: { tenantId, nome: `Gaxeta QA ${randomUUID()}`, slug: `qa-pk-${randomUUID()}`, sku, precoCentavos: 0, ativo, imagens: [], atributos: { perfil: "BS", material: "NBR", diametroInternoMm: 20, diametroExternoMm: 30, alturaMm: 4 } } });
    idsProdutos.push(produto.id);
    return produto;
  };
  const semResultado = (indice: number) => {
    const consulta = `PK${100_000 + (numero + indice) % 800_000}`;
    consultas.add(consulta);
    return consulta;
  };

  try {
    await t.test("24 gravações concorrentes incrementam uma única linha diária sem perder ocorrências", async () => {
      const resultados = await Promise.all(Array.from({ length: 24 }, () => registrarDemandaPk(pk, codigo, agora)));
      assert.ok(resultados.every(Boolean));
      const linhas = await prisma.demandaBuscaPk.findMany({ where: { tenantId: pk.id, consulta: codigo } });
      assert.equal(linhas.length, 1);
      assert.equal(linhas[0].ocorrencias, 24);
      assert.equal(linhas[0].dia.toISOString(), hoje.toISOString());
      assert.equal(await prisma.demandaBuscaPk.count({ where: { tenantId: outra.id } }), 0);
    });

    await t.test("catálogo da própria loja impede contagem; catálogo de outra loja e produto inativo não impedem", async () => {
      const presente = semResultado(1), exclusivoOutra = semResultado(2), inativo = semResultado(3);
      await criarProduto(pk.id, presente);
      await criarProduto(outra.id, exclusivoOutra);
      await criarProduto(pk.id, inativo, false);
      assert.equal(await registrarDemandaPk(pk, presente, agora), false);
      assert.equal(await prisma.demandaBuscaPk.count({ where: { tenantId: pk.id, consulta: presente } }), 0);
      assert.equal(await registrarDemandaPk(pk, exclusivoOutra, agora), true);
      assert.equal(await registrarDemandaPk(pk, inativo, agora), true);
      assert.equal(await registrarDemandaPk(outra, exclusivoOutra, agora), false);
      assert.deepEqual(await relatorioDemandasPk(outra, agora), []);
      assert.equal(await registrarDemandaPk(pk, "nome@email.com", agora), false);
    });

    await t.test("90 dias preservam o dia limite e expurgam o anterior; FK impede agregação órfã", async () => {
      const limite = semResultado(4), expirado = semResultado(5), outraAntiga = semResultado(6);
      await prisma.demandaBuscaPk.createMany({ data: [
        { tenantId: pk.id, tipo: "codigo", consulta: limite, dia: new Date(hoje.getTime() - 89 * dia), ocorrencias: 2 },
        { tenantId: pk.id, tipo: "codigo", consulta: expirado, dia: new Date(hoje.getTime() - 90 * dia), ocorrencias: 3 },
        { tenantId: outra.id, tipo: "codigo", consulta: outraAntiga, dia: new Date(hoje.getTime() - 90 * dia), ocorrencias: 4 },
      ] });
      await expurgarDemandasPk(agora);
      assert.equal(await prisma.demandaBuscaPk.count({ where: { tenantId: pk.id, consulta: limite } }), 1);
      assert.equal(await prisma.demandaBuscaPk.count({ where: { tenantId: pk.id, consulta: expirado } }), 0);
      assert.equal(await prisma.demandaBuscaPk.count({ where: { tenantId: outra.id, consulta: outraAntiga } }), 1);
      await assert.rejects(() => prisma.demandaBuscaPk.create({ data: { tenantId: `inexistente-${randomUUID()}`, tipo: "codigo", consulta: "123456", dia: hoje } }), /foreign key|constraint|Foreign key/i);
    });

    await t.test("relatório soma dias, limita 50 e exclui dados de fora dos últimos 30 dias e de outra loja", async () => {
      const foraPeriodo = semResultado(7), primeiroDia = semResultado(8), dominanteOutra = semResultado(9);
      const ranking = Array.from({ length: 55 }, (_, i) => ({ tenantId: pk.id, tipo: "codigo", consulta: semResultado(100 + i), dia: hoje, ocorrencias: 10_000 + i }));
      await prisma.demandaBuscaPk.createMany({ data: [
        ...ranking,
        { tenantId: pk.id, tipo: "codigo", consulta: foraPeriodo, dia: new Date(hoje.getTime() - 30 * dia), ocorrencias: 1_000_000 },
        { tenantId: pk.id, tipo: "codigo", consulta: primeiroDia, dia: new Date(hoje.getTime() - 29 * dia), ocorrencias: 20_000 },
        { tenantId: pk.id, tipo: "codigo", consulta: primeiroDia, dia: hoje, ocorrencias: 10 },
        { tenantId: outra.id, tipo: "codigo", consulta: dominanteOutra, dia: hoje, ocorrencias: 2_000_000 },
      ] });
      const relatorio = await relatorioDemandasPk(pk, agora);
      assert.equal(relatorio.length, 50);
      assert.equal(relatorio[0].consulta, primeiroDia);
      assert.equal(relatorio[0]._sum.ocorrencias, 20_010);
      assert.ok(!relatorio.some(l => l.consulta === foraPeriodo || l.consulta === dominanteOutra));
      assert.ok(relatorio.every((l, i) => i === 0 || (relatorio[i - 1]._sum.ocorrencias ?? 0) >= (l._sum.ocorrencias ?? 0)));
    });

    await t.test("comparação encontra produto sob consulta e rejeita slug de outra loja; cotação usa somente catálogo PK", async () => {
      const sku = semResultado(10), skuOutra = semResultado(11);
      const proprio = await criarProduto(pk.id, sku);
      const alheio = await criarProduto(outra.id, skuOutra);
      const carregado = await buscarProduto(pk.id, proprio.slug);
      assert.ok(carregado);
      assert.equal(carregado.precoCentavos, 0);
      assert.deepEqual(carregado.imagens, []);
      assert.equal(await buscarProduto(pk.id, alheio.slug), null);
      assert.equal(await buscarProduto(outra.id, proprio.slug), null);
      const catalogo = await listarProdutos(pk.id);
      const itens = resolverCotacao([{ codigo: sku, quantidade: 2 }, { codigo: skuOutra, quantidade: 1 }], catalogo, true);
      assert.equal(itens[0].estado, "consulta-preco");
      assert.equal(itens[0].produtos[0].slug, proprio.slug);
      assert.equal(itens[1].estado, "nao-encontrado");
      assert.deepEqual(itens[1].produtos, []);
      assert.equal(await prisma.pedido.count({ where: { tenantId: pk.id } }), pedidosAntes);
    });

    assert.equal(chaveDemandaPk(outra.id, outra.slug, codigo, agora), null);
  } finally {
    await prisma.demandaBuscaPk.deleteMany({ where: { tenantId: pk.id, consulta: { in: [...consultas] } } });
    await prisma.produto.deleteMany({ where: { id: { in: idsProdutos } } });
    await prisma.tenant.delete({ where: { id: outra.id } });
    if (!existente) await prisma.tenant.delete({ where: { id: pk.id } });
  }
});
