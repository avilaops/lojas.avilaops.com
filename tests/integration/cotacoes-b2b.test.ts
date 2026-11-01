import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { aprovarVersaoCatalogoB2B } from "../../src/lib/catalogo-b2b";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { aprovarCotacaoB2B, contraproporCotacaoB2B, converterCotacaoB2B, criarCotacaoB2B, recomprarCotacaoB2B, submeterCotacaoB2B } from "../../src/lib/cotacoes-b2b";
import { registrarCheckCotacao } from "../helpers/mlops-evidence";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(() => prisma.$disconnect());
const chave = () => randomUUID().replace(/-/g, "");

test("negociação preserva versões e conversão idempotente preserva o preço aprovado", async () => {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-cot-fluxo-${chave()}`, nome: "QA", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Indústria Cliente" } });
  const unidade = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" } });
  const conta = await prisma.comprador.create({ data: { tenantId: tenant.id, email: `compras-${chave()}@example.test`, senhaHash: "hash", nome: "Compras" } });
  const comprador = await prisma.compradorEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorId: conta.id, nome: conta.nome, emailNormalizado: conta.email } });
  await prisma.escopoCompradorB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorEmpresaId: comprador.id, papel: "APROVADOR", escopo: "UNIDADE", unidadeId: unidade.id, limiteAprovacaoCentavos: 100_000, contextoVersao: 1 } });
  await prisma.escopoCompradorB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorEmpresaId: comprador.id, papel: "ADMINISTRADOR", escopo: "ORGANIZACAO", limiteAprovacaoCentavos: null, contextoVersao: 1 } });
  const centroCusto = await prisma.centroCustoB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, codigo: "COMPRAS", nome: "Compras" } });
  const produtoCriado = await salvarProdutoNoCatalogo(tenant.id, null, { nome: "Rolamento", slug: `p-${chave()}`, sku: `P-${chave()}`, precoCentavos: 2_000, estoque: 20, imagens: ["https://example.com/rolamento.webp"] });
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: produtoCriado.id }, include: { variantes: true } });
  const catalogo = await prisma.catalogoB2B.create({ data: { tenantId: tenant.id, referencia: `cat-${chave()}`, nome: "Contrato", versoes: { create: { versao: 1, vigenteDesde: new Date(Date.now() - 1_000), atribuicoes: { create: { empresaId: empresa.id, unidadeId: unidade.id } }, itens: { create: { produtoId: produto.id, varianteId: produto.variantes[0].id, acao: "INCLUIR", estrategiaPreco: "FIXO", precoFixoCentavos: 1_500, quantidadeMinima: 1, multiploVenda: 1, quantidadePorEmbalagem: 1, unidadeComercial: "UN", unidadesBaseNumerador: 1, unidadesBaseDenominador: 1 } } } } } });
  assert.ok(catalogo.id);
  await aprovarVersaoCatalogoB2B(tenant.id, catalogo.id, 1, "qa");
  const ator = { tipo: "VENDEDOR", email: "vendas@example.test" };
  const criada = await criarCotacaoB2B(tenant.id, { empresaId: empresa.id, unidadeId: unidade.id, compradorEmpresaId: comprador.id, centroCustoId: centroCusto.id, pedidoCompra: "PO-123", responsavelEmail: ator.email, validaAte: new Date(Date.now() + 86_400_000), itens: [{ produtoId: produto.id, varianteId: produto.variantes[0].id, quantidade: 2 }] }, ator);
  const negociada = await contraproporCotacaoB2B(tenant.id, criada.id, { itens: [{ produtoId: produto.id, varianteId: produto.variantes[0].id, quantidade: 3, precoUnitarioCentavos: 1_400 }], condicoes: { pagamento: "30 dias" }, justificativa: "Preço aprovado pela diretoria" }, { tipo: "COMPRADOR", id: comprador.id, email: conta.email });
  assert.deepEqual(negociada.versoes.map((v) => [v.numero, v.totalCentavos]), [[1, 3_000], [2, 4_200]]);
  await submeterCotacaoB2B(tenant.id, criada.id, { tipo: "COMPRADOR", id: comprador.id, email: conta.email });
  await aprovarCotacaoB2B(tenant.id, criada.id, comprador.id, { tipo: "APROVADOR", id: comprador.id, email: conta.email });
  const primeiro = await converterCotacaoB2B(tenant.id, criada.id, "idem-conversao-1", ator);
  const repetido = await converterCotacaoB2B(tenant.id, criada.id, "idem-conversao-1", ator);
  assert.equal(repetido.id, primeiro.id);
  assert.deepEqual(primeiro.itens.map((i) => [i.quantidade, i.precoUnitarioCentavos]), [[3, 1_400]]);
  assert.equal(primeiro.empresaB2BId, empresa.id);
  assert.equal(primeiro.unidadeB2BId, unidade.id);
  assert.equal(primeiro.centroCustoB2BId, centroCusto.id);
  assert.equal(primeiro.pedidoCompra, "PO-123");
  assert.equal(primeiro.cotacaoVersao, 2);
  assert.deepEqual(primeiro.condicoesComerciais, { pagamento: "30 dias" });
  assert.equal(primeiro.pagamentoId, null);
  const persistido = await prisma.pedido.findUniqueOrThrow({ where: { id: primeiro.id }, include: { itens: true } });
  assert.deepEqual(
    {
      empresaB2BId: persistido.empresaB2BId,
      unidadeB2BId: persistido.unidadeB2BId,
      centroCustoB2BId: persistido.centroCustoB2BId,
      cotacaoVersao: persistido.cotacaoVersao,
      itens: persistido.itens.map((item) => [item.quantidade, item.precoUnitarioCentavos]),
    },
    {
      empresaB2BId: primeiro.empresaB2BId,
      unidadeB2BId: primeiro.unidadeB2BId,
      centroCustoB2BId: primeiro.centroCustoB2BId,
      cotacaoVersao: primeiro.cotacaoVersao,
      itens: primeiro.itens.map((item) => [item.quantidade, item.precoUnitarioCentavos]),
    },
  );
  assert.equal(await prisma.pedido.count({ where: { origem: `cotacao:${criada.id}` } }), 1);
  const aprovada = await prisma.cotacaoB2B.findUniqueOrThrow({ where: { id: criada.id } });
  assert.equal(aprovada.aprovacaoExcecao, true);
  assert.equal(aprovada.aprovacaoJustificativa, "Preço aprovado pela diretoria");
  const recompra = await recomprarCotacaoB2B(tenant.id, criada.id, new Date(Date.now() + 86_400_000), { tipo: "COMPRADOR", id: comprador.id, email: conta.email });
  assert.equal(recompra.estado, "RASCUNHO");
  assert.equal(recompra.versoes[0].totalCentavos, 4_500);
  await registrarCheckCotacao("preco", { assertions: { approvedPricePreserved: true, approvedQuantityPreserved: true, conditionsPreserved: true, repurchaseUsesCurrentPrice: true }, metrics: { approvedTotalCentavos: primeiro.totalCentavos, repurchaseTotalCentavos: recompra.versoes[0].totalCentavos } });
  const relido = await prisma.pedido.findFirstOrThrow({ where: { tenantId: tenant.id, id: primeiro.id }, include: { itens: true } });
  assert.equal(relido.empresaB2BId, primeiro.empresaB2BId);
  assert.equal(relido.unidadeB2BId, unidade.id);
  assert.equal(relido.cotacaoVersao, 2);
  assert.equal(relido.totalCentavos, primeiro.totalCentavos);
  assert.deepEqual(relido.itens, primeiro.itens);
  await registrarCheckCotacao("resposta", { assertions: { readbackMatches: true, companyPreserved: true, unitPreserved: true, approvedVersionPreserved: true } });
});
