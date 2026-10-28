import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { aprovarCotacaoB2B, contraproporCotacaoB2B, converterCotacaoB2B, criarCotacaoB2B, obterCotacaoB2B, submeterCotacaoB2B } from "../../src/lib/cotacoes-b2b";
import { registrarCheckCotacao } from "../helpers/mlops-evidence";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(() => prisma.$disconnect());

async function preparar() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-cot-atom-${randomUUID()}`, nome: "QA", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Cliente" } });
  const conta = await prisma.comprador.create({ data: { tenantId: tenant.id, nome: "Comprador QA", email: `${randomUUID()}@example.test`, senhaHash: "hash-privado-que-nao-pode-sair-na-api" } });
  const comprador = await prisma.compradorEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorId: conta.id, nome: conta.nome, emailNormalizado: conta.email } });
  await prisma.escopoCompradorB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorEmpresaId: comprador.id, papel: "APROVADOR", escopo: "ORGANIZACAO", contextoVersao: 1 } });
  const produto = await salvarProdutoNoCatalogo(tenant.id, null, { nome: "Peça QA", slug: `peca-${randomUUID()}`, sku: `P-${randomUUID()}`, precoCentavos: 1_000, estoque: 20, imagens: ["https://example.test/peca.webp"] });
  const variante = await prisma.variante.findFirstOrThrow({ where: { tenantId: tenant.id, produtoId: produto.id } });
  const ator = { tipo: "VENDEDOR", email: "vendas@example.test" };
  const criar = async (aprovar: boolean | "rascunho" = true) => {
    const cotacao = await criarCotacaoB2B(tenant.id, { empresaId: empresa.id, compradorEmpresaId: comprador.id, responsavelEmail: ator.email,
      validaAte: new Date(Date.now() + 86_400_000), itens: [{ produtoId: produto.id, varianteId: variante.id, quantidade: 2 }] }, ator);
    if (aprovar !== "rascunho") {
      await submeterCotacaoB2B(tenant.id, cotacao.id, ator);
      if (aprovar) await aprovarCotacaoB2B(tenant.id, cotacao.id, comprador.id, { tipo: "APROVADOR", id: comprador.id });
    }
    return cotacao;
  };
  return { tenant, empresa, comprador, conta, variante, ator, criar };
}

test("projeção de cotação nunca serializa credenciais do comprador", async () => {
  const c = await preparar();
  const cotacao = await c.criar();
  const lida = await obterCotacaoB2B(c.tenant.id, cotacao.id);
  assert.equal(JSON.stringify(lida).includes("senhaHash"), false);
  assert.equal(JSON.stringify(lida).includes(c.conta.senhaHash), false);
});

test("conversão concorrente gera um pedido, uma reserva e um evento", async t => {
  const c = await preparar();
  const cotacao = await c.criar();
  const requests = t.mock.method(globalThis, "fetch", async () => { throw new Error("Nenhuma chamada externa é permitida neste teste."); });
  const pedidos = await Promise.all(Array.from({ length: 3 }, () => converterCotacaoB2B(c.tenant.id, cotacao.id, "mesma-chave-concorrente", c.ator)));
  assert.equal(new Set(pedidos.map(pedido => pedido.id)).size, 1);
  assert.equal(await prisma.pedido.count({ where: { tenantId: c.tenant.id, origem: `cotacao:${cotacao.id}` } }), 1);
  assert.equal(await prisma.eventoCotacaoB2B.count({ where: { tenantId: c.tenant.id, cotacaoId: cotacao.id, tipo: "CONVERTIDA" } }), 1);
  const saldo = await prisma.saldoEstoque.findFirstOrThrow({ where: { tenantId: c.tenant.id, varianteId: c.variante.id, local: "principal" } });
  assert.equal(saldo.reservado, 2);
  assert.equal(saldo.fisico, 20);
  assert.equal(requests.mock.callCount(), 0);
  await registrarCheckCotacao("idempotencia", { assertions: { oneOrder: true, oneEvent: true, oneReservation: true, noExternalRequest: true }, metrics: { attempts: 3, reserved: saldo.reservado } });
});

test("falha na criação reverte reserva e permite nova tentativa da cotação", async () => {
  const c = await preparar();
  const primeira = await c.criar();
  const segunda = await c.criar();
  await converterCotacaoB2B(c.tenant.id, primeira.id, "chave-ja-utilizada", c.ator);
  await assert.rejects(converterCotacaoB2B(c.tenant.id, segunda.id, "chave-ja-utilizada", c.ator));
  const referencia = `cotacao:${segunda.id}`;
  assert.equal(await prisma.tentativaCatalogo.count({ where: { tenantId: c.tenant.id, referencia } }), 0);
  assert.equal(await prisma.reservaEstoque.count({ where: { tenantId: c.tenant.id, referencia } }), 0);
  const novoPedido = await converterCotacaoB2B(c.tenant.id, segunda.id, "nova-chave-valida", c.ator);
  assert.equal(novoPedido.totalCentavos, 2_000);
  const saldo = await prisma.saldoEstoque.findFirstOrThrow({ where: { tenantId: c.tenant.id, varianteId: c.variante.id, local: "principal" } });
  assert.equal(saldo.reservado, 4);
});

test("cotação recusa outro tenant, comprador fora do escopo e alçada insuficiente", async () => {
  const c = await preparar();
  const cotacao = await c.criar(false);
  const outroTenant = await prisma.tenant.create({ data: { slug: `qa-outro-${randomUUID()}`, nome: "Outro", status: "ATIVA" } });
  await assert.rejects(obterCotacaoB2B(outroTenant.id, cotacao.id));
  await assert.rejects(converterCotacaoB2B(outroTenant.id, cotacao.id, "chave-outro-tenant", c.ator));
  const outroComprador = await prisma.compradorEmpresaB2B.create({ data: { tenantId: c.tenant.id, empresaId: c.empresa.id, nome: "Sem escopo", emailNormalizado: `${randomUUID()}@example.test` } });
  await assert.rejects(aprovarCotacaoB2B(c.tenant.id, cotacao.id, outroComprador.id, { tipo: "APROVADOR", id: outroComprador.id }), /escopo/i);
  await prisma.escopoCompradorB2B.updateMany({ where: { tenantId: c.tenant.id, compradorEmpresaId: c.comprador.id }, data: { limiteAprovacaoCentavos: 1_000 } });
  await assert.rejects(aprovarCotacaoB2B(c.tenant.id, cotacao.id, c.comprador.id, { tipo: "APROVADOR", id: c.comprador.id }), /alçada/i);
  const atual = await obterCotacaoB2B(c.tenant.id, cotacao.id);
  assert.equal(atual.estado, "AGUARDANDO_APROVACAO");
  assert.equal(atual.pedidoId, null);
  assert.equal(await prisma.eventoCotacaoB2B.count({ where: { tenantId: c.tenant.id, cotacaoId: cotacao.id, tipo: "APROVADA" } }), 0);
  await registrarCheckCotacao("isolamento", { assertions: { otherTenantRejected: true, outOfScopeRejected: true, approvalLimitEnforced: true, noOrder: true } });
});

test("contrapropostas concorrentes preservam versões e eventos sem expor conflito transiente", async () => {
  const c = await preparar();
  const cotacao = await c.criar("rascunho");
  await Promise.all([1, 2, 3].map(quantidade => contraproporCotacaoB2B(c.tenant.id, cotacao.id, {
    itens: [{ produtoId: c.variante.produtoId, varianteId: c.variante.id, quantidade }],
  }, c.ator)));
  const atual = await obterCotacaoB2B(c.tenant.id, cotacao.id);
  assert.equal(atual.versaoAtual, 4);
  assert.deepEqual(atual.versoes.map(versao => versao.numero), [1, 2, 3, 4]);
  assert.equal(atual.eventos.filter(evento => evento.tipo === "CONTRAPROPOSTA").length, 3);
  assert.equal(atual.pedidoId, null);
  assert.equal(await prisma.reservaEstoque.count({ where: { tenantId: c.tenant.id } }), 0);
});

test("revisão antiga, cotação expirada e falta de aprovação não criam pedido", async () => {
  const c = await preparar();
  const cotacao = await c.criar("rascunho");
  const itens = [{ produtoId: c.variante.produtoId, varianteId: c.variante.id, quantidade: 2 }];
  await contraproporCotacaoB2B(c.tenant.id, cotacao.id, { itens, versaoEsperada: 1 }, c.ator);
  await assert.rejects(contraproporCotacaoB2B(c.tenant.id, cotacao.id, { itens, versaoEsperada: 1 }, c.ator), /mudou|revisão/i);
  const atual = await obterCotacaoB2B(c.tenant.id, cotacao.id);
  assert.equal(atual.versaoAtual, 2);
  assert.equal(atual.versoes.length, 2);
  await assert.rejects(converterCotacaoB2B(c.tenant.id, cotacao.id, "sem-aprovacao", c.ator), /aprovada/i);
  await prisma.cotacaoB2B.update({ where: { id: cotacao.id }, data: { validaAte: new Date(Date.now() - 1000) } });
  await assert.rejects(submeterCotacaoB2B(c.tenant.id, cotacao.id, c.ator), /expirada/i);
  const aprovada = await c.criar();
  await prisma.cotacaoB2B.update({ where: { id: aprovada.id }, data: { validaAte: new Date(Date.now() - 1000) } });
  await assert.rejects(converterCotacaoB2B(c.tenant.id, aprovada.id, "conversao-expirada", c.ator), /expirada/i);
  assert.equal(await prisma.pedido.count({ where: { tenantId: c.tenant.id } }), 0);
  assert.equal(await prisma.reservaEstoque.count({ where: { tenantId: c.tenant.id } }), 0);
  await registrarCheckCotacao("falhas", { assertions: { staleRevisionRejected: true, expiredSubmissionRejected: true, expiredConversionRejected: true, approvalRequired: true, noOrderOrReservation: true } });
});
