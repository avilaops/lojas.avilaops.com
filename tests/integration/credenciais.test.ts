import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MercadoPagoProvider } from "@avilaops/checkout/server";
import { prisma } from "../../src/lib/db";
import { cifrar, decifrar } from "../../src/lib/cofre";
import { definirPadrao, garantirCredencialMercadoPago, PadraoRecusado, providerDoPedido, resolverRecebimento, salvarCredencial, urlDoWebhook } from "../../src/lib/credenciais";
import { GatewayNaoConfigurado } from "../../src/lib/gateway";
import { lojaVende } from "../../src/lib/tenant";

/** Credenciais de pagamento contra o Postgres de verdade. Dados fictícios. */

process.env.LOJAS_SECRET ??= "0".repeat(64);
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);
const loja = (dados: Record<string, unknown> = {}) =>
  prisma.tenant.create({ data: { slug: `qa-cred-${sufixo()}`, nome: "QA Cred", status: "ATIVA", ...dados } });

test("loja só com MP nas colunas mp*: vende igual, ganha a credencial legado e cobra com o MP de antes", async () => {
  const t = await loja({ mpAccessTokenEnc: cifrar("TEST-token"), mpPublicKey: "TEST-pub" });
  assert.equal(lojaVende(t), true);
  const r = await resolverRecebimento(t);
  assert.ok(r.provider instanceof MercadoPagoProvider);
  assert.equal(r.credencial?.provedor, "mercadopago");
  assert.equal(r.credencial?.segredosEnc, null, "legado: segredo continua no Tenant");
  const depois = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
  assert.equal(depois.credencialPadraoId, r.credencial?.id);
  assert.equal(depois.provedorPadrao, "mercadopago");
  assert.equal(lojaVende(depois), true);
  // De novo não duplica.
  await garantirCredencialMercadoPago(depois);
  assert.equal(await prisma.credencialPagamento.count({ where: { tenantId: t.id } }), 1);
  assert.match(urlDoWebhook(r.credencial!), /\/api\/webhooks\/pagamentos\/mercadopago\/[0-9a-f]{48}$/);
});

test("loja sem nada não vende e não monta provedor", async () => {
  const t = await loja();
  assert.equal(lojaVende(t), false);
  await assert.rejects(resolverRecebimento(t), GatewayNaoConfigurado);
});

test("credencial nova: segredos cifrados, status do teste, e só Conectado vira padrão", async () => {
  const t = await loja();
  const ruim = await salvarCredencial(t, "mercadopago", { segredos: { accessToken: "APP_USR-segredo" }, publicos: { publicKey: "APP_USR-pub" } }, { ok: false, mensagem: "O Mercado Pago recusou o acesso.", avisos: [] });
  assert.equal(ruim.status, "erro");
  assert.ok(ruim.segredosEnc && !ruim.segredosEnc.includes("APP_USR-segredo"));
  assert.deepEqual(JSON.parse(decifrar(ruim.segredosEnc!)), { accessToken: "APP_USR-segredo" });
  await assert.rejects(definirPadrao(t, ruim.id), PadraoRecusado);

  const boa = await salvarCredencial(t, "mercadopago", { segredos: { accessToken: "APP_USR-segredo" }, publicos: {} }, { ok: true, mensagem: "ok", conta: "QA", avisos: [] });
  assert.equal(boa.id, ruim.id, "uma por provedor por loja");
  await definirPadrao(t, boa.id);
  const depois = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
  const r = await resolverRecebimento(depois);
  assert.ok(r.provider instanceof MercadoPagoProvider);
  assert.equal(r.credencial?.id, boa.id);
});

test("pedido usa a credencial que o cobrou, não a padrão atual", async () => {
  const outra = await loja();
  const t = await loja({ mpAccessTokenEnc: cifrar("TEST-token") });
  const { credencial } = await resolverRecebimento(t);
  const alheia = await salvarCredencial(outra, "mercadopago", { segredos: { accessToken: "x" }, publicos: {} }, { ok: true, mensagem: "ok", avisos: [] });
  assert.ok((await providerDoPedido(t, { credencialId: credencial!.id })) instanceof MercadoPagoProvider);
  // Credencial de outra loja gravada no pedido não é usada: cai no provedor da própria loja.
  assert.ok((await providerDoPedido(t, { credencialId: alheia.id })) instanceof MercadoPagoProvider);
  assert.ok((await providerDoPedido(t, { credencialId: null })) instanceof MercadoPagoProvider);
});
