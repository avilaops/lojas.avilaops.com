import { after, before, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { escoposDaChave, gerarChave } from "../../src/lib/api-chaves";
import { referenciaDaCompra } from "../../src/lib/api-checkout";
import { cifrar } from "../../src/lib/cofre";
import { salvarGradeNoCatalogo, salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";
import { POST as postCheckout } from "../../src/app/api/v1/vitrine/checkout/route";
import { POST as postFrete } from "../../src/app/api/v1/vitrine/frete/route";
import { GET as getPedido } from "../../src/app/api/v1/vitrine/pedidos/[referencia]/route";
import { GET as getProduto } from "../../src/app/api/v1/vitrine/produtos/[id]/route";
import { GET as getLoja } from "../../src/app/api/v1/vitrine/loja/route";

/**
 * A compra pela chave publicável, contra o Postgres. As rotas são as de
 * verdade; o Mercado Pago é que é de mentira (`fetch` simulado), porque o
 * gateway é criado dentro da rota a partir do token da loja.
 *
 * A chave publicável é pública: está no JavaScript do site do lojista. Cada
 * teste aqui é o que um estranho com essa chave tentaria.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
process.env.LOJAS_SECRET ??= "0".repeat(64);
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");
const SITE = "https://www.loja-do-lojista.example";
const ENDERECO = { logradouro: "Rua QA", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" };

// ── O Mercado Pago de mentira ───────────────────────────────────────────
const fetchOriginal = globalThis.fetch;
let cobrancasNoGateway: Array<{ valor: number; idempotencia: string | null; metodo: string }> = [];
before(() => {
  globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const destino = String(entrada);
    if (!destino.startsWith("https://api.mercadopago.com")) return fetchOriginal(entrada as never, init);
    if (init?.method === "POST") {
      const corpo = JSON.parse(String(init.body)) as { transaction_amount: number; payment_method_id: string };
      cobrancasNoGateway.push({ valor: Math.round(corpo.transaction_amount * 100), idempotencia: new Headers(init.headers).get("x-idempotency-key"), metodo: corpo.payment_method_id });
      return Response.json({ id: 9000 + cobrancasNoGateway.length, status: "pending", payment_method_id: "pix", transaction_amount: corpo.transaction_amount, point_of_interaction: { transaction_data: { qr_code: "00020126PIXCOPIAECOLA", qr_code_base64: "QUJD" } } }, { status: 201 });
    }
    // Consulta de um pagamento já criado.
    return Response.json({ id: Number(destino.split("/").pop()), status: "pending", payment_method_id: "pix", transaction_amount: 49.9, point_of_interaction: { transaction_data: { qr_code: "00020126PIXCOPIAECOLA", qr_code_base64: "QUJD" } } });
  }) as typeof fetch;
});
after(() => { globalThis.fetch = fetchOriginal; });

// ── Montagem ────────────────────────────────────────────────────────────
async function loja(extras: Record<string, unknown> = {}) {
  return prisma.tenant.create({
    data: {
      slug: `qa-pk-${sufixo()}`, nome: "QA Compra", status: "ATIVA", plano: "LOJA",
      retiradaNaLoja: true, enderecoPublico: true, endereco: ENDERECO,
      mpAccessTokenEnc: cifrar("TEST-token"), mpWebhookSecretEnc: cifrar("segredo"), mpPublicKey: "TEST-public-key",
      ...extras,
    },
  });
}

async function chave(tenantId: string, opcoes: { compra?: boolean; origens?: string[] } = {}) {
  const g = gerarChave("PUBLICAVEL");
  await prisma.chaveApi.create({
    data: {
      tenantId, tipo: "PUBLICAVEL", nome: "Site", hash: g.hash, prefixo: g.prefixo, final: g.final,
      escopos: escoposDaChave("PUBLICAVEL", opcoes.compra === false ? [] : ["vitrine:comprar"]),
      origens: opcoes.origens ?? [SITE],
    },
  });
  return g.chave;
}

const produto = (tenantId: string, estoque = 5) =>
  salvarProdutoNoCatalogo(tenantId, null, {
    nome: "Limpador QA 500ml", slug: `produto-${sufixo()}`, precoCentavos: 4990, sku: `QA-${sufixo()}`, estoque,
    imagens: ["https://example.com/frasco.webp"], descricao: "Limpador para a prova da compra.",
  });

function compra(produtoId: string, extras: Record<string, unknown> = {}) {
  return {
    itens: [{ id: produtoId, quantidade: 1 }],
    cliente: { nome: "Maria", sobrenome: "Silva", email: "maria@example.test", telefone: "11999999999", documento: "52998224725" },
    entrega: null,
    freteId: "retirada-na-loja",
    meioPagamento: "pix",
    ...extras,
  };
}

type Rota<P> = (r: Request, s: { params: Promise<P> }) => Promise<Response>;
/** Cada chamada vem de um endereço diferente, salvo quando o teste é sobre o limite. */
async function chamar<P>(rota: Rota<P>, metodo: string, caminho: string, chaveApi: string, opcoes: { corpo?: unknown; params?: P; origem?: string | null; cabecalhos?: Record<string, string>; endereco?: string } = {}) {
  const r = await rota(
    new Request(`https://lojas.avilaops.com${caminho}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${chaveApi}`,
        "content-type": "application/json",
        "cf-connecting-ip": opcoes.endereco ?? `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        ...(opcoes.origem === null ? {} : { origin: opcoes.origem ?? SITE }),
        ...opcoes.cabecalhos,
      },
      ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    }),
    { params: Promise.resolve((opcoes.params ?? {}) as P) },
  );
  return { status: r.status, cabecalhos: r.headers, corpo: (await r.json()) as { dados?: Record<string, unknown> & unknown[]; erro?: { codigo: string; mensagem: string; detalhe?: string } } };
}

const comprar = (k: string, corpo: unknown, opcoes: { origem?: string | null; cabecalhos?: Record<string, string>; endereco?: string } = {}) =>
  chamar(postCheckout, "POST", "/api/v1/vitrine/checkout", k, { ...opcoes, corpo });
const limpar = (t: TestContext) => { cobrancasNoGateway = []; t.after(() => { cobrancasNoGateway = []; }); };

test("compra por Pix: o preço sai do servidor, o pedido nasce e a referência devolvida consulta o status", async (t) => {
  limpar(t);
  const l = await loja();
  const k = await chave(l.id);
  const p = await produto(l.id);

  const r = await comprar(k, compra(p.id, { itens: [{ id: p.id, quantidade: 2 }], totalCentavos: 9980 }));
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const d = r.corpo.dados as Record<string, unknown>;
  assert.match(String(d.referencia), /^api-[0-9a-f]{32}$/);
  assert.equal(d.valorCentavos, 9980);
  assert.equal(d.status, "pendente");
  assert.equal((d.pix as Record<string, unknown>).copiaECola, "00020126PIXCOPIAECOLA");
  assert.equal(d.repetida, false);
  assert.deepEqual(cobrancasNoGateway.map((c) => [c.valor, c.idempotencia]), [[9980, d.referencia]]);
  // Resposta de compra só a origem conferida lê.
  assert.equal(r.cabecalhos.get("access-control-allow-origin"), SITE);

  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { referencia: String(d.referencia) } });
  assert.equal(pedido.tenantId, l.id);
  assert.equal(pedido.totalCentavos, 9980);
  assert.match(String(pedido.origem), /^api:/);

  const status = await chamar(getPedido, "GET", `/api/v1/vitrine/pedidos/${d.referencia}`, k, { params: { referencia: String(d.referencia) } });
  assert.equal(status.status, 200);
  assert.equal((status.corpo.dados as Record<string, unknown>).status, "AGUARDANDO_PAGAMENTO");
  assert.equal((status.corpo.dados as Record<string, unknown>).pago, false);
  // Nada de dado pessoal na consulta de status.
  for (const pessoal of ["maria@example.test", "52998224725", "11999999999", "Silva"]) assert.equal(JSON.stringify(status.corpo).includes(pessoal), false, pessoal);
});

test("preço, total e campo desconhecido no corpo não mudam o que é cobrado", async (t) => {
  limpar(t);
  const l = await loja();
  const k = await chave(l.id);
  const p = await produto(l.id);

  for (const adulterado of [
    compra(p.id, { preco: 1 }),
    compra(p.id, { itens: [{ id: p.id, quantidade: 1, precoUnitario: 1 }] }),
    compra(p.id, { referencia: "eu-escolho-a-referencia-0001" }),
    compra(p.id, { cupom: "DESCONTO100" }),
  ]) {
    const r = await comprar(k, adulterado);
    assert.equal(r.status, 400, JSON.stringify(adulterado));
    assert.equal(r.corpo.erro?.codigo, "parametro_invalido");
  }
  // Total que o front mostrou diferente do que o servidor calcula: recusa, não cobra o do front.
  const divergente = await comprar(k, compra(p.id, { totalCentavos: 100 }));
  assert.equal(divergente.status, 422);
  assert.equal(divergente.corpo.erro?.detalhe, "total_divergente");
  assert.equal(cobrancasNoGateway.length, 0);
});

test("chave publicável sem a compra marcada não vende, nem consulta pedido", async (t) => {
  limpar(t);
  const l = await loja();
  const soVitrine = await chave(l.id, { compra: false });
  const p = await produto(l.id);

  const r = await comprar(soVitrine, compra(p.id));
  assert.equal(r.status, 403);
  assert.equal(r.corpo.erro?.codigo, "escopo_insuficiente");
  assert.equal((await chamar(getPedido, "GET", "/api/v1/vitrine/pedidos/x", soVitrine, { params: { referencia: "x" } })).status, 403);
  // Ler a vitrine e cotar frete continuam valendo.
  assert.equal((await chamar(postFrete, "POST", "/api/v1/vitrine/frete", soVitrine, { corpo: { cep: "14010000", itens: [{ id: p.id, quantidade: 1 }] } })).status, 200);
  assert.equal(cobrancasNoGateway.length, 0);
});

test("outro site não compra com a chave do lojista; app sem origem, sim", async (t) => {
  limpar(t);
  const l = await loja();
  const k = await chave(l.id, { origens: [SITE] });
  const p = await produto(l.id);

  const alheio = await comprar(k, compra(p.id), { origem: "https://site-de-outro.example" });
  assert.equal(alheio.status, 403);
  assert.equal(alheio.corpo.erro?.codigo, "origem_nao_permitida");
  assert.equal(cobrancasNoGateway.length, 0);

  assert.equal((await comprar(k, compra(p.id), { origem: null })).status, 200);
  // Chave sem site nenhum: navegador é recusado, seja de onde for.
  const semSite = await chave(l.id, { origens: [] });
  assert.equal((await comprar(semSite, compra(p.id), { origem: SITE })).status, 403);
});

test("produto de outra loja, loja suspensa e loja sem recebimento não viram cobrança", async (t) => {
  limpar(t);
  const [a, b] = [await loja(), await loja()];
  const k = await chave(a.id);
  const doVizinho = await produto(b.id);
  const meu = await produto(a.id);

  const alheio = await comprar(k, compra(doVizinho.id));
  assert.equal(alheio.status, 422);
  assert.equal(alheio.corpo.erro?.detalhe, "item_indisponivel");

  // Suspensa: a chave ainda autentica (a vitrine continua), mas não vende.
  await prisma.tenant.update({ where: { id: a.id }, data: { status: "SUSPENSA" } });
  const suspensa = await comprar(k, compra(meu.id));
  assert.equal(suspensa.status, 403);
  assert.equal(suspensa.corpo.erro?.codigo, "loja_nao_vende");

  const semGateway = await loja({ mpAccessTokenEnc: null });
  const p2 = await produto(semGateway.id);
  assert.equal((await comprar(await chave(semGateway.id), compra(p2.id))).corpo.erro?.codigo, "loja_nao_vende");
  assert.equal(cobrancasNoGateway.length, 0);
});

test("Idempotency-Key repetida devolve a mesma cobrança e não cobra de novo", async (t) => {
  limpar(t);
  const l = await loja();
  const k = await chave(l.id);
  const p = await produto(l.id, 5);
  const cabecalhos = { "idempotency-key": `compra-${sufixo()}` };

  const primeira = await comprar(k, compra(p.id), { cabecalhos });
  assert.equal(primeira.status, 200, JSON.stringify(primeira.corpo));
  const segunda = await comprar(k, compra(p.id), { cabecalhos });
  assert.equal(segunda.status, 200, JSON.stringify(segunda.corpo));

  const [a, b] = [primeira.corpo.dados as Record<string, unknown>, segunda.corpo.dados as Record<string, unknown>];
  assert.equal(b.referencia, a.referencia);
  assert.equal(b.repetida, true);
  assert.equal((b.pix as Record<string, unknown>).copiaECola, "00020126PIXCOPIAECOLA");
  assert.equal(cobrancasNoGateway.length, 1);
  assert.equal(await prisma.pedido.count({ where: { tenantId: l.id } }), 1);
  // Só uma unidade saiu do disponível.
  assert.equal((await resolverItensPadronizados(l.id, [{ id: p.id, quantidade: 4 }])).length, 1);

  // A mesma chave de idempotência em outra chave da API é outra compra.
  assert.notEqual(referenciaDaCompra("chave-a", "abc"), referenciaDaCompra("chave-b", "abc"));
  const torta = await comprar(k, compra(p.id), { cabecalhos: { "idempotency-key": "curta" } });
  assert.equal(torta.status, 400);
});

test("a referência de uma loja não consulta pedido pela chave de outra", async (t) => {
  limpar(t);
  const [a, b] = [await loja(), await loja()];
  const [ka, kb] = [await chave(a.id), await chave(b.id)];
  const p = await produto(a.id);
  const r = await comprar(ka, compra(p.id));
  const referencia = String((r.corpo.dados as Record<string, unknown>).referencia);

  assert.equal((await chamar(getPedido, "GET", `/api/v1/vitrine/pedidos/${referencia}`, kb, { params: { referencia } })).status, 404);
  assert.equal((await chamar(getPedido, "GET", `/api/v1/vitrine/pedidos/${referencia}`, ka, { params: { referencia } })).status, 200);
});

test("um mesmo endereço não compra sem parar, e não esgota a vez dos outros", async (t) => {
  limpar(t);
  const l = await loja();
  const k = await chave(l.id);
  const p = await produto(l.id, 50);
  const endereco = "203.0.113.50";

  const status: number[] = [];
  for (let i = 0; i < 8; i++) status.push((await comprar(k, compra(p.id), { endereco })).status);
  assert.deepEqual(status, [200, 200, 200, 200, 200, 200, 429, 429]);
  assert.equal((await comprar(k, compra(p.id), { endereco: "203.0.113.51" })).status, 200);
  assert.equal(cobrancasNoGateway.length, 7);
});

test("frete, produto com variações e loja dão ao front o que ele precisa para montar a compra", async () => {
  const l = await loja();
  const k = await chave(l.id);
  const p = await produto(l.id);
  const grade = await salvarGradeNoCatalogo(l.id, p.id, ["Volume"], [
    { valores: { Volume: "5L" }, sku: `G-${sufixo()}`, precoCentavos: 9000, estoque: 3 },
    { valores: { Volume: "500ml" }, sku: `G-${sufixo()}`, precoCentavos: 1000, estoque: 0 },
  ]);

  // Com variações, o que vai no carrinho é o id da variação, não o do produto.
  const item = `${p.id}:${grade.variantes[0].id}`;
  const frete = await chamar(postFrete, "POST", "/api/v1/vitrine/frete", k, { corpo: { cep: "00000000", itens: [{ id: item, quantidade: 1 }] } });
  assert.equal(frete.status, 200, JSON.stringify(frete.corpo));
  assert.deepEqual((frete.corpo.dados as unknown as Array<Record<string, unknown>>).map((f) => [f.id, f.precoCentavos]), [["retirada-na-loja", 0]]);
  const fantasma = await chamar(postFrete, "POST", "/api/v1/vitrine/frete", k, { corpo: { cep: "14010000", itens: [{ id: "nao-existe", quantidade: 1 }] } });
  assert.equal(fantasma.status, 422);

  const detalhe = await chamar(getProduto, "GET", `/api/v1/vitrine/produtos/${p.slug}`, k, { params: { id: p.slug } });
  assert.equal(detalhe.status, 200, JSON.stringify(detalhe.corpo));
  const variantes = (detalhe.corpo.dados as Record<string, unknown>).variantes as Array<Record<string, unknown>>;
  assert.equal(variantes.length, 2);
  assert.deepEqual(variantes.map((v) => v.id).sort(), grade.variantes.map((v) => `${p.id}:${v.id}`).sort());
  assert.deepEqual(variantes.map((v) => [v.precoCentavos, v.disponivel]).sort(), [[1000, false], [9000, true]]);
  // Disponível é sim ou não: a contagem de estoque não sai por chave pública.
  // (O rótulo "Em estoque" sai, como na vitrine; o campo com o número, não.)
  assert.equal(/"(estoque|saldos|fisico|reservado)"\s*:/.test(JSON.stringify(detalhe.corpo)), false);

  const dadosDaLoja = (await chamar(getLoja, "GET", "/api/v1/vitrine/loja", k)).corpo.dados as Record<string, unknown>;
  assert.deepEqual(dadosDaLoja.pagamento, { meios: ["pix", "cartao", "boleto"], mercadoPagoPublicKey: "TEST-public-key" });
  assert.equal(dadosDaLoja.retiradaNaLoja, true);
  assert.equal(JSON.stringify(dadosDaLoja).includes("TEST-token"), false);
});
