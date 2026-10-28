import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import {
  aprovarCotacaoB2B,
  converterCotacaoB2B,
  criarCotacaoB2B,
  obterCotacaoB2B,
  submeterCotacaoB2B,
} from "../../src/lib/cotacoes-b2b";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

async function preparar() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-cot-acesso-${randomUUID()}`, nome: "QA", status: "ATIVA" } });
  const outroTenant = await prisma.tenant.create({ data: { slug: `qa-cot-invasor-${randomUUID()}`, nome: "Outra loja", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Cliente" } });
  const outraEmpresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "outra", razaoSocial: "Outra empresa" } });
  const conta = await prisma.comprador.create({ data: { tenantId: tenant.id, nome: "Comprador", email: `${randomUUID()}@example.test`, senhaHash: "hash" } });
  const aprovador = await prisma.compradorEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorId: conta.id, nome: conta.nome, emailNormalizado: conta.email } });
  const contaFora = await prisma.comprador.create({ data: { tenantId: tenant.id, nome: "Fora", email: `${randomUUID()}@example.test`, senhaHash: "hash" } });
  const aprovadorFora = await prisma.compradorEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: outraEmpresa.id, compradorId: contaFora.id, nome: contaFora.nome, emailNormalizado: contaFora.email } });
  await prisma.escopoCompradorB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorEmpresaId: aprovador.id, papel: "APROVADOR", escopo: "ORGANIZACAO", limiteAprovacaoCentavos: 1_999, contextoVersao: 1 } });
  await prisma.escopoCompradorB2B.create({ data: { tenantId: tenant.id, empresaId: outraEmpresa.id, compradorEmpresaId: aprovadorFora.id, papel: "ADMINISTRADOR", escopo: "ORGANIZACAO", limiteAprovacaoCentavos: null, contextoVersao: 1 } });
  const produto = await salvarProdutoNoCatalogo(tenant.id, null, { nome: "Peça", slug: `peca-${randomUUID()}`, sku: `P-${randomUUID()}`, precoCentavos: 2_000, estoque: 5, imagens: ["https://example.test/peca.webp"] });
  const variante = await prisma.variante.findFirstOrThrow({ where: { tenantId: tenant.id, produtoId: produto.id } });
  const ator = { tipo: "VENDEDOR", email: "vendas@example.test" };
  const cotacao = await criarCotacaoB2B(tenant.id, {
    empresaId: empresa.id,
    compradorEmpresaId: aprovador.id,
    responsavelEmail: ator.email,
    validaAte: new Date(Date.now() + 86_400_000),
    itens: [{ produtoId: produto.id, varianteId: variante.id, quantidade: 1 }],
  }, ator);
  await submeterCotacaoB2B(tenant.id, cotacao.id, ator);
  return { tenant, outroTenant, aprovador, aprovadorFora, cotacao, ator };
}

test("outra loja não lê, avança nem converte a cotação", async () => {
  const c = await preparar();
  await assert.rejects(obterCotacaoB2B(c.outroTenant.id, c.cotacao.id));
  await assert.rejects(submeterCotacaoB2B(c.outroTenant.id, c.cotacao.id, c.ator));
  await assert.rejects(converterCotacaoB2B(c.outroTenant.id, c.cotacao.id, "tentativa-fora-do-tenant", c.ator));
  assert.equal(await prisma.pedido.count({ where: { origem: `cotacao:${c.cotacao.id}` } }), 0);
  assert.equal(await prisma.reservaEstoque.count({ where: { referencia: `cotacao:${c.cotacao.id}` } }), 0);
});

test("aprovação recusa vínculo de outra empresa e valor acima da alçada", async () => {
  const c = await preparar();
  await assert.rejects(
    aprovarCotacaoB2B(c.tenant.id, c.cotacao.id, c.aprovadorFora.id, { tipo: "APROVADOR", id: c.aprovadorFora.id }),
    /escopo/i,
  );
  await assert.rejects(
    aprovarCotacaoB2B(c.tenant.id, c.cotacao.id, c.aprovador.id, { tipo: "APROVADOR", id: c.aprovador.id }),
    /alçada/i,
  );
  const atual = await prisma.cotacaoB2B.findUniqueOrThrow({ where: { id: c.cotacao.id } });
  assert.equal(atual.estado, "AGUARDANDO_APROVACAO");
  assert.equal(atual.versaoAprovada, null);
});
