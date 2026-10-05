import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Plano, TipoChaveApi } from "@prisma/client";
import { prisma } from "../../src/lib/db";
import { escoposDaChave, gerarChave } from "../../src/lib/api-chaves";
import { ajustarOfertaNoCatalogo, salvarGradeNoCatalogo, salvarProdutoNoCatalogo, SkuMudouDuranteAGravacao } from "../../src/lib/catalogo-escrita";
import { GET as getLoja } from "../../src/app/api/v1/loja/route";
import { GET as getProdutos } from "../../src/app/api/v1/produtos/route";
import { GET as getProduto } from "../../src/app/api/v1/produtos/[id]/route";
import { GET as getPedidos } from "../../src/app/api/v1/pedidos/route";
import { GET as getVitrineProdutos } from "../../src/app/api/v1/vitrine/produtos/route";
import { PATCH as patchOfertas } from "../../src/app/api/v1/ofertas/route";

/**
 * A API para desenvolvedores contra o Postgres de verdade: chave por hash,
 * escopo, revogação, plano e, acima de tudo, uma loja nunca vendo a outra.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");

async function loja(plano: Plano = "LOJA_PRO") {
  return prisma.tenant.create({ data: { slug: `qa-api-${sufixo()}`, nome: "QA API", status: "ATIVA", plano } });
}

async function chave(tenantId: string, tipo: TipoChaveApi, escopos: string[] = ["loja:ler", "catalogo:ler", "pedidos:ler"]) {
  const g = gerarChave(tipo);
  await prisma.chaveApi.create({
    data: { tenantId, tipo, nome: "QA", escopos: escoposDaChave(tipo, escopos), hash: g.hash, prefixo: g.prefixo, final: g.final },
  });
  return g.chave;
}

async function chamar<P>(rota: (r: Request, s: { params: Promise<P> }) => Promise<Response>, caminho: string, chaveApi?: string, params?: P) {
  const r = await rota(
    new Request(`https://lojas.avilaops.com${caminho}`, { headers: chaveApi ? { authorization: `Bearer ${chaveApi}` } : {} }),
    { params: Promise.resolve((params ?? {}) as P) },
  );
  return { status: r.status, corpo: await r.json(), cabecalhos: r.headers };
}

async function enviar(corpo: unknown, chaveApi: string) {
  const r = await patchOfertas(
    new Request("https://lojas.avilaops.com/api/v1/ofertas", {
      method: "PATCH",
      headers: { authorization: `Bearer ${chaveApi}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({}) },
  );
  return { status: r.status, corpo: await r.json() };
}

async function produto(tenantId: string, extras: Parameters<typeof salvarProdutoNoCatalogo>[2] = {}) {
  return salvarProdutoNoCatalogo(tenantId, null, {
    nome: "Produto QA", slug: `produto-${sufixo()}`, precoCentavos: 4990, sku: `QA-${sufixo()}`, estoque: 5, ...extras,
  });
}

test("chave secreta lê a própria loja e diz quais escopos tem", async () => {
  const t = await loja();
  const sk = await chave(t.id, "SECRETA", ["loja:ler"]);
  const r = await chamar(getLoja, "/api/v1/loja", sk);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.dados.slug, t.slug);
  assert.deepEqual(r.corpo.dados.chave.escopos.map((e: { escopo: string }) => e.escopo), ["loja:ler", "vitrine:ler"]);
  assert.ok(r.cabecalhos.get("ratelimit-limit"));
  assert.ok(r.cabecalhos.get("x-requisicao-id"));
});

test("sem chave, chave inventada e chave revogada respondem com o código certo", async () => {
  const t = await loja();
  assert.equal((await chamar(getLoja, "/api/v1/loja")).corpo.erro.codigo, "chave_ausente");
  assert.equal((await chamar(getLoja, "/api/v1/loja", gerarChave("SECRETA").chave)).corpo.erro.codigo, "chave_invalida");
  const sk = await chave(t.id, "SECRETA");
  await prisma.chaveApi.updateMany({ where: { tenantId: t.id }, data: { revogadaEm: new Date() } });
  const r = await chamar(getLoja, "/api/v1/loja", sk);
  assert.equal(r.status, 401);
  assert.equal(r.corpo.erro.codigo, "chave_revogada");
});

test("chave publicável não lê catálogo do painel nem pedidos, só a vitrine", async () => {
  const t = await loja("SITE");
  await produto(t.id);
  const pk = await chave(t.id, "PUBLICAVEL", ["pedidos:ler"]);
  assert.equal((await chamar(getPedidos, "/api/v1/pedidos", pk)).corpo.erro.codigo, "escopo_insuficiente");
  assert.equal((await chamar(getProdutos, "/api/v1/produtos", pk)).status, 403);
  const v = await chamar(getVitrineProdutos, "/api/v1/vitrine/produtos", pk);
  assert.equal(v.status, 200);
  assert.equal(v.corpo.dados.length, 1);
  assert.equal("estoque" in v.corpo.dados[0], false);
  assert.equal(v.cabecalhos.get("access-control-allow-origin"), "*");
});

test("rebaixar o plano desliga a chave secreta sem revogá-la", async () => {
  const t = await loja();
  const sk = await chave(t.id, "SECRETA");
  await prisma.tenant.update({ where: { id: t.id }, data: { plano: "LOJA" } });
  assert.equal((await chamar(getLoja, "/api/v1/loja", sk)).corpo.erro.codigo, "plano_sem_api");
  await prisma.tenant.update({ where: { id: t.id }, data: { plano: "LOJA_PRO" } });
  assert.equal((await chamar(getLoja, "/api/v1/loja", sk)).status, 200);
});

test("uma loja nunca enxerga produto nem pedido da outra", async () => {
  const a = await loja(), b = await loja();
  const pa = await produto(a.id);
  await prisma.pedido.create({
    data: {
      tenantId: a.id, referencia: `qa-${sufixo()}`, clienteNome: "Cliente A", clienteEmail: "a@example.com",
      clienteTelefone: "11999999999", clienteDocumento: "00000000000", freteNome: "PAC", freteCentavos: 0,
      subtotalCentavos: 4990, totalCentavos: 4990, meioPagamento: "pix",
    },
  });
  const skB = await chave(b.id, "SECRETA");
  assert.equal((await chamar(getProdutos, "/api/v1/produtos", skB)).corpo.paginacao.total, 0);
  assert.equal((await chamar(getPedidos, "/api/v1/pedidos", skB)).corpo.paginacao.total, 0);
  const cruzado = await chamar(getProduto, `/api/v1/produtos/${pa.id}`, skB, { id: pa.id });
  assert.equal(cruzado.status, 404);
  assert.equal(cruzado.corpo.erro.codigo, "nao_encontrado");

  const skA = await chave(a.id, "SECRETA");
  const proprio = await chamar(getProduto, `/api/v1/produtos/${pa.slug}`, skA, { id: pa.slug });
  assert.equal(proprio.status, 200);
  assert.equal(proprio.corpo.dados.precoCentavos, 4990);
  assert.deepEqual(proprio.corpo.dados.variantes, [], "a variante padrão interna não é variação do cadastro");
  const pedidos = await chamar(getPedidos, "/api/v1/pedidos", skA);
  assert.equal(pedidos.corpo.dados[0].cliente.nome, "Cliente A");
  assert.equal(pedidos.corpo.dados[0].totalCentavos, 4990);
});

test("catálogo do painel inclui inativos, filtra e pagina; a vitrine não mostra inativo", async () => {
  const t = await loja();
  await produto(t.id, { nome: "Retentor 20x47x7" });
  await produto(t.id, { nome: "Rolamento 6205" });
  await produto(t.id, { nome: "Item desligado", ativo: false });
  const sk = await chave(t.id, "SECRETA");

  const todos = await chamar(getProdutos, "/api/v1/produtos?porPagina=2", sk);
  assert.equal(todos.corpo.paginacao.total, 3);
  assert.equal(todos.corpo.dados.length, 2);
  assert.equal(todos.corpo.paginacao.totalPaginas, 2);
  assert.equal((await chamar(getProdutos, "/api/v1/produtos?ativo=false", sk)).corpo.paginacao.total, 1);
  assert.equal((await chamar(getProdutos, "/api/v1/produtos?busca=retentores", sk)).corpo.paginacao.total, 1);
  assert.equal((await chamar(getProdutos, "/api/v1/produtos?porPagina=1000", sk)).corpo.erro.codigo, "parametro_invalido");

  const vitrine = await chamar(getVitrineProdutos, "/api/v1/vitrine/produtos", sk);
  assert.equal(vitrine.corpo.paginacao.total, 2);
});

test("ERP grava preço e estoque por SKU; reenviar o mesmo lote não cria versão", async () => {
  const t = await loja();
  const p = await produto(t.id, { sku: `ERP-${sufixo()}`, precoCentavos: 4990, estoque: 5 });
  const sk = await chave(t.id, "SECRETA", ["catalogo:ler", "catalogo:escrever"]);

  const r = await enviar({ itens: [{ sku: p.sku, precoCentavos: 5990, precoDeCentavos: 6990, estoque: 12 }] }, sk);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.dados.atualizados, 1);
  assert.equal(r.corpo.dados.itens[0].situacao, "atualizado");

  const lido = await chamar(getProduto, `/api/v1/produtos/${p.id}`, sk, { id: p.id });
  assert.equal(lido.corpo.dados.precoCentavos, 5990);
  assert.equal(lido.corpo.dados.precoDeCentavos, 6990);
  assert.equal(lido.corpo.dados.estoque, 12);

  const versao = (await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).versaoCatalogo;
  const historico = await prisma.historicoCatalogo.findFirstOrThrow({ where: { produtoId: p.id, versao } });
  assert.match(historico.origem, /^api:/, "o histórico diz que foi a API, e por qual chave");

  const de_novo = await enviar({ itens: [{ sku: p.sku, precoCentavos: 5990, estoque: 12 }] }, sk);
  assert.equal(de_novo.corpo.dados.itens[0].situacao, "sem_mudanca");
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).versaoCatalogo, versao);
});

test("SKU de variação muda só aquela variação; SKU desconhecido não derruba o lote", async () => {
  const t = await loja();
  const p = await produto(t.id);
  await salvarGradeNoCatalogo(t.id, p.id, ["Volume"], [
    { valores: { Volume: "500ml" }, sku: `V500-${sufixo()}`, precoCentavos: 1000, estoque: 2 },
    { valores: { Volume: "5L" }, sku: `V5L-${sufixo()}`, precoCentavos: 2000, estoque: 1 },
  ]);
  const [v500, v5l] = await prisma.variante.findMany({ where: { produtoId: p.id, padrao: false }, orderBy: { ordem: "asc" } });
  const sk = await chave(t.id, "SECRETA", ["catalogo:escrever"]);

  const r = await enviar({ itens: [{ sku: v5l.sku, precoCentavos: 2500 }, { sku: "NAO-EXISTE", estoque: 3 }] }, sk);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.dados.atualizados, 1);
  assert.equal(r.corpo.dados.erros, 1);
  assert.equal(r.corpo.dados.itens[1].erro.codigo, "nao_encontrado");

  const preco = async (id: string) => (await prisma.precoVariante.findUniqueOrThrow({ where: { varianteId: id } })).valorCentavos;
  assert.equal(await preco(v5l.id), 2500);
  assert.equal(await preco(v500.id), 1000);
});

test("SKU renomeado entre a resolução e a trava: o item volta conflito e nada muda", async () => {
  const t = await loja();
  const p = await produto(t.id);
  const skuAntigo = `V500-${sufixo()}`, skuNovo = `RENOMEADO-${sufixo()}`;
  await salvarGradeNoCatalogo(t.id, p.id, ["Volume"], [
    { valores: { Volume: "500ml" }, sku: skuAntigo, precoCentavos: 1000, estoque: 2 },
    { valores: { Volume: "5L" }, sku: `V5L-${sufixo()}`, precoCentavos: 2000, estoque: 1 },
  ]);
  const v500 = await prisma.variante.findFirstOrThrow({ where: { produtoId: p.id, sku: skuAntigo } });
  const sk = await chave(t.id, "SECRETA", ["catalogo:escrever"]);

  const estado = async () => ({
    preco: (await prisma.precoVariante.findUniqueOrThrow({ where: { varianteId: v500.id } })).valorCentavos,
    fisico: (await prisma.saldoEstoque.findFirstOrThrow({ where: { varianteId: v500.id, local: "principal" } })).fisico,
    versao: (await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).versaoCatalogo,
    historico: await prisma.historicoCatalogo.count({ where: { produtoId: p.id } }),
  });
  const antes = await estado();

  // A corrida de verdade: outra transação segura a trava do produto (é o que
  // o painel faz ao salvar a grade), a chamada do ERP resolve o SKU e fica
  // esperando a trava, e só então o SKU é renomeado e a trava é solta.
  let pendente!: ReturnType<typeof enviar>;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Produto" WHERE id=${p.id} AND "tenantId"=${t.id} FOR UPDATE`;
    pendente = enviar({ itens: [{ sku: skuAntigo, precoCentavos: 9999, estoque: 77 }] }, sk);
    let esperando = 0;
    for (let i = 0; i < 100 && esperando === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const [linha] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM "Produto"%FOR UPDATE%'`;
      esperando = Number(linha.n);
    }
    assert.equal(esperando, 1, "a chamada do ERP tem de estar parada na trava do produto, com o SKU já resolvido");
    await tx.variante.update({ where: { id: v500.id }, data: { sku: skuNovo } });
  }, { timeout: 20000 });

  const r = await pendente;
  assert.equal(r.status, 200);
  assert.equal(r.corpo.dados.atualizados, 0);
  assert.equal(r.corpo.dados.erros, 1);
  assert.equal(r.corpo.dados.itens[0].situacao, "erro");
  assert.equal(r.corpo.dados.itens[0].erro.codigo, "conflito");
  assert.equal(r.corpo.dados.itens[0].varianteId, undefined, "o id resolvido já não é o deste SKU");
  assert.deepEqual(await estado(), antes, "preço, estoque, versão e histórico da variação renomeada ficam intactos");

  // Depois da corrida o contrato segue o normal: o SKU antigo não existe mais
  // e o novo grava.
  const antigo = await enviar({ itens: [{ sku: skuAntigo, precoCentavos: 9999 }] }, sk);
  assert.equal(antigo.corpo.dados.itens[0].erro.codigo, "nao_encontrado");
  const novo = await enviar({ itens: [{ sku: skuNovo, precoCentavos: 1500 }] }, sk);
  assert.equal(novo.corpo.dados.itens[0].situacao, "atualizado");
  assert.equal((await estado()).preco, 1500);
});

test("ajuste por id sem SKU esperado continua valendo; com SKU errado é recusado sem gravar", async () => {
  const t = await loja();
  const p = await produto(t.id, { sku: `DIRETO-${sufixo()}`, precoCentavos: 4990, estoque: 5 });
  const v = await prisma.variante.findFirstOrThrow({ where: { produtoId: p.id, padrao: true } });
  const versao = async () => (await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).versaoCatalogo;
  const inicial = await versao();

  await assert.rejects(
    ajustarOfertaNoCatalogo(t.id, v.id, { precoCentavos: 1 }, "teste", "OUTRO-SKU"),
    (e: unknown) => e instanceof SkuMudouDuranteAGravacao && e.status === 409,
  );
  assert.equal(await versao(), inicial);
  assert.equal((await prisma.precoVariante.findUniqueOrThrow({ where: { varianteId: v.id } })).valorCentavos, 4990);

  assert.equal((await ajustarOfertaNoCatalogo(t.id, v.id, { precoCentavos: 5990 }, "teste")).mudou, true);
  assert.equal((await ajustarOfertaNoCatalogo(t.id, v.id, { precoCentavos: 6990 }, "teste", p.sku!)).mudou, true);
});

test("SKU de outra loja é 'não encontrado', e nada muda nela", async () => {
  const a = await loja(), b = await loja();
  const pa = await produto(a.id, { sku: `CRUZ-${sufixo()}`, precoCentavos: 4990 });
  const skB = await chave(b.id, "SECRETA", ["catalogo:escrever"]);
  const r = await enviar({ itens: [{ sku: pa.sku, precoCentavos: 1 }] }, skB);
  assert.equal(r.corpo.dados.itens[0].erro.codigo, "nao_encontrado");
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: pa.id } })).precoCentavos, 4990);
});

test("lote mal formado é recusado inteiro, antes de gravar qualquer coisa", async () => {
  const t = await loja();
  const p = await produto(t.id, { sku: `LOTE-${sufixo()}` });
  const sk = await chave(t.id, "SECRETA", ["catalogo:escrever"]);
  const reais = await enviar({ itens: [{ sku: p.sku, preco: 49.9 }] }, sk);
  assert.equal(reais.status, 400, "campo desconhecido (preço em reais) não é ignorado em silêncio");
  assert.equal(reais.corpo.erro.codigo, "parametro_invalido");
  assert.equal((await enviar({ itens: [{ sku: p.sku, precoCentavos: 49.9 }] }, sk)).status, 400);
  assert.equal((await enviar({ itens: [{ sku: p.sku, estoque: 1 }, { sku: p.sku, estoque: 2 }] }, sk)).status, 400);
  assert.equal((await enviar({ itens: [] }, sk)).status, 400);

  const soLeitura = await chave(t.id, "SECRETA", ["catalogo:ler"]);
  assert.equal((await enviar({ itens: [{ sku: p.sku, estoque: 1 }] }, soLeitura)).corpo.erro.codigo, "escopo_insuficiente");
});
