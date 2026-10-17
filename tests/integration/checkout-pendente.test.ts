import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ResultadoPagamento } from "@avilaops/checkout";
import type { PaymentProvider } from "@avilaops/checkout/server";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { criarCobranca, lerCorpoDoCheckout } from "../../src/lib/checkout-cobranca";
import { responderPendencia } from "../../src/lib/checkout-pendente";
import { reconciliarReservas } from "../../src/lib/reservas-reconciliar";

/**
 * `GET /api/checkout/pendente` contra o Postgres: o que o /checkout ouve quando
 * pergunta por uma referência que ficou guardada no navegador.
 *
 * A rota só resolve a loja pelo host (`headers()` do Next) e chama
 * `responderPendencia`, que é o que se prova aqui. As tentativas nascem do
 * checkout de verdade, com um gateway de mentira.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");

const loja = () =>
  prisma.tenant.create({
    data: {
      slug: `qa-pd-${sufixo()}`, nome: "QA Pendente", status: "ATIVA", plano: "LOJA", retiradaNaLoja: true, enderecoPublico: true,
      endereco: { logradouro: "Rua QA", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" },
    },
  });

const produto = (tenantId: string) =>
  salvarProdutoNoCatalogo(tenantId, null, {
    nome: "Limpador QA 500ml", slug: `produto-${sufixo()}`, precoCentavos: 4990, sku: `QA-${sufixo()}`, estoque: 5,
    imagens: ["https://example.com/frasco.webp"], descricao: "Limpador para a prova da pendência.",
  });

function gateway(cobrar?: PaymentProvider["cobrar"]): PaymentProvider {
  return {
    nome: "dublê",
    cobrar: cobrar ?? (async (pedido, total) => ({ id: `pg-${sufixo()}`, status: "pendente", meioPagamento: pedido.meioPagamento, valor: total }) as ResultadoPagamento),
    consultar: async () => { throw new Error("não usado"); },
    buscarPorReferencia: async () => null,
    estornar: async () => { throw new Error("não usado"); },
    validarWebhook: async () => null,
  };
}
const tempoLimite = () => gateway(async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); });

/** Passa pelo checkout e devolve a referência enviada. */
async function comprar(t: Awaited<ReturnType<typeof loja>>, provider: PaymentProvider) {
  const p = await produto(t.id);
  const referencia = `QA-${sufixo()}`;
  const lido = lerCorpoDoCheckout({
    referencia, itens: [{ id: p.id, quantidade: 1 }], entrega: null, freteId: "retirada-na-loja", meioPagamento: "pix",
    cliente: { nome: "Maria", sobrenome: "Silva", email: "maria@example.test", telefone: "11999999999", documento: "52998224725" },
  });
  assert.ok(!("tipo" in lido), "corpo do checkout válido");
  const r = await criarCobranca(t, lido.corpo, { provider });
  return { referencia, tipo: r.tipo };
}

const consultar = (t: { id: string } | null, referencia: string) => responderPendencia(t, `https://loja.example.test/api/checkout/pendente?referencia=${encodeURIComponent(referencia)}`);
async function situacao(t: { id: string }, referencia: string) {
  const r = await consultar(t, referencia);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const corpo = await r.json();
  assert.deepEqual(Object.keys(corpo), ["situacao"], "a rota só responde a situação");
  return corpo.situacao;
}
const estadoDa = async (referencia: string) => (await prisma.tentativaCatalogo.findUnique({ where: { referencia } }))?.estado;

test("tentativa INCERTA responde pendente; depois que a reconciliação libera, responde livre", async () => {
  const t = await loja();
  const g = tempoLimite();
  const { referencia, tipo } = await comprar(t, g);
  assert.equal(tipo, "incerto");
  assert.equal(await estadoDa(referencia), "INCERTA");
  assert.equal(await situacao(t, referencia), "pendente");

  await prisma.$executeRaw`UPDATE "TentativaCatalogo" SET "atualizadoEm" = now() - interval '20 minutes' WHERE referencia = ${referencia}`;
  await reconciliarReservas({ providerDe: () => g });
  assert.equal(await estadoDa(referencia), "LIBERADA");
  assert.equal(await situacao(t, referencia), "livre");
});

test("referência de outra loja responde livre, igual a referência que não existe", async () => {
  const [a, b] = [await loja(), await loja()];
  const { referencia } = await comprar(a, tempoLimite());
  assert.equal(await situacao(a, referencia), "pendente");
  assert.equal(await situacao(b, referencia), "livre");
  assert.equal(await situacao(b, `QA-${sufixo()}`), "livre");
});

test("referência curta, longa demais ou ausente é 400, e loja que não existe é 404, sem consultar nada", async () => {
  const t = await loja();
  for (const referencia of ["", "   ", "QA-123", "A".repeat(15), "A".repeat(121)]) {
    const r = await consultar(t, referencia);
    assert.equal(r.status, 400, JSON.stringify(referencia));
    assert.deepEqual(await r.json(), { erro: "referência inválida" });
  }
  assert.equal((await responderPendencia(t, "https://loja.example.test/api/checkout/pendente")).status, 400);
  assert.equal((await consultar(null, `QA-${sufixo()}`)).status, 404);
});

test("tentativa que ficou RESERVADA (não chegou a ser marcada incerta) responde pendente", async () => {
  const t = await loja();
  const { referencia } = await comprar(t, tempoLimite());
  // O que sobra quando `marcarIncerta` falha depois do tempo-limite do gateway.
  await prisma.tentativaCatalogo.update({ where: { referencia }, data: { estado: "RESERVADA" } });
  assert.equal(await situacao(t, referencia), "pendente");
});

test("pagamento que virou pedido responde pedido; pedido cancelado responde livre", async () => {
  const t = await loja();
  const { referencia, tipo } = await comprar(t, gateway());
  assert.equal(tipo, "ok");
  assert.equal(await situacao(t, referencia), "pedido");
  await prisma.pedido.updateMany({ where: { tenantId: t.id, referencia }, data: { status: "CANCELADO" } });
  assert.equal(await situacao(t, referencia), "livre");
});
