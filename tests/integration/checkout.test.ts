import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ResultadoPagamento } from "@avilaops/checkout";
import { CobrancaRecusada, type PaymentProvider } from "@avilaops/checkout/server";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";
import { criarCobranca, lerCorpoDoCheckout } from "../../src/lib/checkout-cobranca";
import { reconciliarReservas } from "../../src/lib/reservas-reconciliar";

/**
 * O checkout de ponta a ponta contra o Postgres, com um gateway de mentira.
 *
 * A rota de checkout nunca teve teste: o gateway era criado dentro dela. O que
 * se prova aqui é o que custa dinheiro ou estoque quando dá errado — cartão que
 * não passa, estoque que fica preso, cobrança em dobro.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");
const ENDERECO = { logradouro: "Rua QA", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" };

async function loja(extras: { meiosPagamento?: string[] } = {}) {
  return prisma.tenant.create({
    data: {
      slug: `qa-ck-${sufixo()}`, nome: "QA Checkout", status: "ATIVA", plano: "LOJA",
      // Retirada na loja: frete sem transportadora, para o teste não sair para a rede.
      retiradaNaLoja: true, enderecoPublico: true, endereco: ENDERECO,
      ...(extras.meiosPagamento ? { meiosPagamento: extras.meiosPagamento } : {}),
    },
  });
}

const produto = (tenantId: string, estoque = 5) =>
  salvarProdutoNoCatalogo(tenantId, null, {
    nome: "Limpador QA 500ml", slug: `produto-${sufixo()}`, precoCentavos: 4990, sku: `QA-${sufixo()}`, estoque,
    imagens: ["https://example.com/frasco.webp"], descricao: "Limpador para a prova do checkout.",
  });

function corpo(produtoId: string, extras: Record<string, unknown> = {}) {
  return {
    referencia: `QA-${sufixo()}`,
    itens: [{ id: produtoId, quantidade: 1 }],
    cliente: { nome: "Maria", sobrenome: "Silva", email: "maria@example.test", telefone: "11999999999", documento: "52998224725" },
    entrega: null,
    freteId: "retirada-na-loja",
    meioPagamento: "pix",
    ...extras,
  };
}

/** Um gateway que anota o que recebeu e responde o que o teste mandar. */
function gateway(mudancas: Partial<PaymentProvider> = {}) {
  const cobrancas: Array<{ referencia: string; total: number; cartao?: unknown; meio: string }> = [];
  const provider: PaymentProvider = {
    nome: "dublê",
    cobrar: async (pedido, total) => {
      cobrancas.push({ referencia: pedido.referencia, total, cartao: pedido.cartao, meio: pedido.meioPagamento });
      return { id: `pg-${sufixo()}`, status: "pendente", meioPagamento: pedido.meioPagamento, valor: total } as ResultadoPagamento;
    },
    consultar: async () => { throw new Error("não usado"); },
    buscarPorReferencia: async () => null,
    estornar: async () => { throw new Error("não usado"); },
    validarWebhook: async () => null,
    ...mudancas,
  };
  return { provider, cobrancas };
}

async function cobrar(t: Awaited<ReturnType<typeof loja>>, bruto: unknown, provider: PaymentProvider) {
  const lido = lerCorpoDoCheckout(bruto);
  if ("tipo" in lido) return lido;
  return criarCobranca(t, lido.corpo, { provider });
}

const disponivel = async (tenantId: string, produtoId: string, quantidade: number) =>
  (await resolverItensPadronizados(tenantId, [{ id: produtoId, quantidade }])).length === 1;
const estadoDa = async (referencia: string) => (await prisma.tentativaCatalogo.findUnique({ where: { referencia } }))?.estado;
/** A rotina só olha o que está incerto há mais de 15 minutos. */
const envelhecer = (referencia: string) =>
  prisma.$executeRaw`UPDATE "TentativaCatalogo" SET "atualizadoEm" = now() - interval '20 minutes' WHERE referencia = ${referencia}`;

test("Pix: cobra o preço do catálogo, reserva o estoque e registra o pedido", async () => {
  const t = await loja();
  const p = await produto(t.id, 2);
  const g = gateway();
  const c = corpo(p.id, { itens: [{ id: p.id, quantidade: 2 }] });

  const r = await cobrar(t, { ...c, precoUnitario: 1, total: 1 }, g.provider);
  assert.equal(r.tipo, "ok");
  assert.deepEqual(g.cobrancas.map((x) => [x.total, x.meio]), [[9980, "pix"]]);

  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { referencia: c.referencia }, include: { itens: true } });
  assert.equal(pedido.tenantId, t.id);
  assert.equal(pedido.totalCentavos, 9980);
  assert.equal(pedido.status, "AGUARDANDO_PAGAMENTO");
  assert.equal(pedido.itens[0].precoUnitarioCentavos, 4990);
  assert.equal(await estadoDa(c.referencia), "COBRANCA_CRIADA");
  // As duas unidades estão reservadas: ninguém mais compra.
  assert.equal(await disponivel(t.id, p.id, 1), false);
  assert.equal(await prisma.automacaoEvento.count({ where: { slug: t.slug, tipo: "pedido.criado" } }), 1);
});

test("cartão no formato que a tela manda chega ao gateway com token, parcelas e bandeira", async () => {
  const t = await loja();
  const p = await produto(t.id);
  const g = gateway();

  // É exatamente o corpo de CheckoutClient.tsx: o cartão vai aninhado.
  const r = await cobrar(t, corpo(p.id, { meioPagamento: "cartao", cartao: { token: "tok_teste_123", parcelas: 3, bandeira: "visa" } }), g.provider);
  assert.equal(r.tipo, "ok", JSON.stringify(r));
  assert.deepEqual(g.cobrancas[0].cartao, { token: "tok_teste_123", parcelas: 3, bandeira: "visa" });

  // O formato solto na raiz continua valendo, e cartão sem token é recusado.
  const solto = await cobrar(t, corpo(p.id, { meioPagamento: "cartao", cartaoToken: "tok_raiz", parcelas: 2 }), g.provider);
  assert.equal(solto.tipo, "ok", JSON.stringify(solto));
  assert.deepEqual(g.cobrancas[1].cartao, { token: "tok_raiz", parcelas: 2 });
  const sem = await cobrar(t, corpo(p.id, { meioPagamento: "cartao" }), g.provider);
  assert.equal(sem.tipo === "invalido" && sem.codigo, "cartao_sem_token");
  assert.equal(g.cobrancas.length, 2);
});

test("meio que a loja não aceita, ou que não existe, é recusado sem reservar nem cobrar", async () => {
  const t = await loja({ meiosPagamento: ["pix"] });
  const p = await produto(t.id, 1);
  const g = gateway();

  const cartao = await cobrar(t, corpo(p.id, { meioPagamento: "cartao", cartao: { token: "tok" } }), g.provider);
  assert.equal(cartao.tipo === "invalido" && cartao.codigo, "meio_indisponivel");
  const inventado = await cobrar(t, corpo(p.id, { meioPagamento: "x" }), g.provider);
  assert.equal(inventado.tipo === "invalido" && inventado.codigo, "corpo_invalido");

  assert.equal(g.cobrancas.length, 0);
  assert.equal(await prisma.tentativaCatalogo.count({ where: { tenantId: t.id } }), 0);
  assert.equal(await disponivel(t.id, p.id, 1), true);
});

test("corpo torto é recusado com o campo, e não vira erro interno", async () => {
  const t = await loja();
  const p = await produto(t.id);
  const g = gateway();
  const base = corpo(p.id);

  for (const [nome, torto] of Object.entries({
    "sem nome": { ...base, cliente: { ...base.cliente, nome: undefined } },
    "sem cliente": { ...base, cliente: undefined },
    "quantidade zero": { ...base, itens: [{ id: p.id, quantidade: 0 }] },
    "quantidade absurda": { ...base, itens: [{ id: p.id, quantidade: 1_000_000 }] },
    "carrinho vazio": { ...base, itens: [] },
    "referência curta": { ...base, referencia: "abc" },
    "parcelas demais": { ...base, meioPagamento: "cartao", cartao: { token: "tok", parcelas: 99 } },
    "não é objeto": null,
  })) {
    const r = await cobrar(t, torto, g.provider);
    assert.equal(r.tipo, "invalido", nome);
  }
  // Entrega sem endereço só passa na retirada.
  const semEndereco = await cobrar(t, corpo(p.id, { freteId: "melhorenvio:1" }), g.provider);
  assert.equal(semEndereco.tipo === "invalido" && semEndereco.codigo, "endereco_obrigatorio");
  assert.equal(g.cobrancas.length, 0);
});

test("gateway recusou: nada foi cobrado e o estoque volta à vitrine na hora", async () => {
  const t = await loja();
  const p = await produto(t.id, 1);
  const g = gateway({ cobrar: async () => { throw new CobrancaRecusada("Mercado Pago recusou a cobrança (400): invalid token", 400); } });
  const c = corpo(p.id);

  const r = await cobrar(t, c, g.provider);
  assert.equal(r.tipo, "recusado");
  assert.equal(await estadoDa(c.referencia), "LIBERADA");
  assert.equal(await disponivel(t.id, p.id, 1), true);
  assert.equal(await prisma.pedido.count({ where: { tenantId: t.id } }), 0);
});

test("tempo-limite: fica incerto com o estoque reservado, e a rotina solta quando a cobrança não nasceu", async () => {
  const t = await loja();
  const p = await produto(t.id, 1);
  const g = gateway({ cobrar: async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); } });
  const c = corpo(p.id);

  const r = await cobrar(t, c, g.provider);
  assert.equal(r.tipo, "incerto");
  assert.equal(await estadoDa(c.referencia), "INCERTA");
  assert.equal(await disponivel(t.id, p.id, 1), false);

  // Cedo demais: o cliente ainda pode estar na tela.
  await reconciliarReservas({ providerDe: () => g.provider });
  assert.equal(await estadoDa(c.referencia), "INCERTA");

  await envelhecer(c.referencia);
  await reconciliarReservas({ providerDe: () => g.provider });
  assert.equal(await estadoDa(c.referencia), "LIBERADA");
  assert.equal(await disponivel(t.id, p.id, 1), true);
});

test("incerto com cobrança pendente no gateway continua reservado; cancelada, solta", async () => {
  const t = await loja();
  const p = await produto(t.id, 1);
  let noGateway: ResultadoPagamento["status"] = "pendente";
  const g = gateway({
    cobrar: async () => { throw new Error("socket hang up"); },
    buscarPorReferencia: async () => ({ id: "pg-1", status: noGateway, meioPagamento: "pix", valor: 4990 }),
  });
  const c = corpo(p.id);
  await cobrar(t, c, g.provider);
  await envelhecer(c.referencia);

  await reconciliarReservas({ providerDe: () => g.provider });
  assert.equal(await estadoDa(c.referencia), "INCERTA");
  assert.equal(await disponivel(t.id, p.id, 1), false);

  noGateway = "cancelado";
  await envelhecer(c.referencia);
  await reconciliarReservas({ providerDe: () => g.provider });
  assert.equal(await estadoDa(c.referencia), "LIBERADA");
  assert.equal(await disponivel(t.id, p.id, 1), true);
});

test("pagamento aprovado sem pedido: não solta o estoque e abre um alerta só", async () => {
  const t = await loja();
  const p = await produto(t.id, 1);
  const g = gateway({
    cobrar: async () => { throw new DOMException("timeout", "TimeoutError"); },
    buscarPorReferencia: async () => ({ id: "pg-aprovado", status: "aprovado", meioPagamento: "pix", valor: 4990 }),
  });
  const c = corpo(p.id);
  await cobrar(t, c, g.provider);
  await envelhecer(c.referencia);

  const primeira = await reconciliarReservas({ providerDe: () => g.provider });
  assert.ok(primeira.pagasSemPedido >= 1);
  await envelhecer(c.referencia);
  await reconciliarReservas({ providerDe: () => g.provider });

  assert.equal(await estadoDa(c.referencia), "PAGA_SEM_PEDIDO");
  assert.equal(await disponivel(t.id, p.id, 1), false);
  const alertas = await prisma.automacaoEvento.findMany({ where: { slug: t.slug, tipo: "operacao.alerta" } });
  assert.equal(alertas.length, 1);
  assert.equal((alertas[0].payload as Record<string, unknown>).codigo, "pagamento.sem-pedido");
  assert.equal((alertas[0].payload as Record<string, unknown>).recurso, c.referencia);
});

test("o mesmo pedido enviado duas vezes ao mesmo tempo gera uma cobrança", async () => {
  const t = await loja();
  const p = await produto(t.id, 5);
  const g = gateway();
  const c = corpo(p.id);

  const respostas = await Promise.all([cobrar(t, c, g.provider), cobrar(t, c, g.provider), cobrar(t, c, g.provider)]);
  assert.equal(respostas.filter((r) => r.tipo === "ok").length, 1);
  assert.equal(respostas.filter((r) => r.tipo === "invalido" && r.status === 409).length, 2);
  assert.equal(g.cobrancas.length, 1);
  assert.equal(await prisma.pedido.count({ where: { tenantId: t.id } }), 1);
  // Só uma unidade saiu do disponível.
  assert.equal(await disponivel(t.id, p.id, 4), true);
  assert.equal(await disponivel(t.id, p.id, 5), false);
});

test("produto de outra loja e estoque insuficiente não viram cobrança", async () => {
  const [a, b] = [await loja(), await loja()];
  const doVizinho = await produto(b.id);
  const pouco = await produto(a.id, 1);
  const g = gateway();

  const alheio = await cobrar(a, corpo(doVizinho.id), g.provider);
  assert.equal(alheio.tipo === "invalido" && alheio.codigo, "item_indisponivel");
  const demais = await cobrar(a, corpo(pouco.id, { itens: [{ id: pouco.id, quantidade: 2 }] }), g.provider);
  assert.equal(demais.tipo === "invalido" && demais.codigo, "item_indisponivel");
  assert.equal(g.cobrancas.length, 0);
});
