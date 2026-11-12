import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { conectar, contasDaLoja, desconectar, tokenDoCanal } from "../../src/lib/contas-canal";
import { decifrar } from "../../src/lib/cofre";

const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(banco.hostname) || banco.port !== "5548" || !banco.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}

process.env.LOJAS_SECRET ??= "0".repeat(64);
process.env.SHOPEE_PARTNER_ID = "2001887";
process.env.SHOPEE_PARTNER_KEY = "chave-sintetica-shopee";
process.env.SHOPEE_URL = "https://openplatform.sandbox.test-stable.shopee.sg";
delete process.env.SHOPEE_AUTH_URL;

const criadas: string[] = [];
const fila: Response[] = [];
const chamadas: string[] = [];
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  const url = new URL(typeof entrada === "string" || entrada instanceof URL ? entrada : entrada.url);
  assert.equal(url.origin, "https://openplatform.sandbox.test-stable.shopee.sg");
  chamadas.push(url.pathname);
  const resposta = fila.shift();
  if (!resposta) throw new Error("A prova não permite chamadas Shopee sem resposta sintética definida.");
  return resposta;
}) as typeof fetch;

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    await prisma.tenant.deleteMany({ where: { id: { in: criadas } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function loja() {
  const t = await prisma.tenant.create({ data: { slug: `qa-shopee-${randomUUID().slice(0, 12)}`, nome: "Loja Shopee QA", status: "ATIVA" } });
  criadas.push(t.id);
  return t;
}
const conta = (tenantId: string) => prisma.contaCanal.findUniqueOrThrow({ where: { tenantId_canal: { tenantId, canal: "shopee" } } });
const retorno = (shopId: string) => new URLSearchParams({ code: "codigo-sintetico", shop_id: shopId });
const CALLBACK = "https://lojas.avilaops.com/canais/shopee/callback";
function prepararConexao(sufixo: string) {
  fila.push(Response.json({ access_token: `acesso-${sufixo}`, refresh_token: `refresh-${sufixo}`, expire_in: 14400 }), Response.json({ shop_name: `Loja ${sufixo} QA` }));
}

test("Shopee cifra os tokens e persiste somente na loja indicada pelo servidor", async () => {
  const a = await loja();
  const b = await loja();
  prepararConexao("isolada");
  await conectar(a.id, "shopee", retorno("778899"), CALLBACK);
  const salva = await conta(a.id);
  assert.notEqual(salva.accessTokenEnc, "acesso-isolada");
  assert.notEqual(salva.refreshTokenEnc, "refresh-isolada");
  assert.equal(decifrar(salva.accessTokenEnc), "acesso-isolada");
  assert.equal(decifrar(salva.refreshTokenEnc), "refresh-isolada");
  assert.equal(salva.contaId, "778899");
  assert.equal(salva.contaNome, "Loja isolada QA");
  assert.deepEqual(await contasDaLoja(b.id), []);
  const publica = await contasDaLoja(a.id);
  assert.equal(publica.length, 1);
  assert.doesNotMatch(JSON.stringify(publica), /acesso-isolada|refresh-isolada|TokenEnc/);
  assert.deepEqual(await tokenDoCanal(a.id, "shopee"), { token: "acesso-isolada", contaId: "778899" });
});

test("Shopee renova uma vez em chamadas concorrentes e guarda o novo refresh cifrado", async () => {
  const t = await loja();
  prepararConexao("antes");
  await conectar(t.id, "shopee", retorno("778899"), CALLBACK);
  const antiga = await conta(t.id);
  await prisma.contaCanal.update({ where: { id: antiga.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
  const antes = chamadas.length;
  fila.push(Response.json({ access_token: "acesso-renovado", refresh_token: "refresh-renovado", expire_in: 14400 }));
  const respostas = await Promise.all(Array.from({ length: 8 }, () => tokenDoCanal(t.id, "shopee")));
  for (const resposta of respostas) assert.deepEqual(resposta, { token: "acesso-renovado", contaId: "778899" });
  assert.deepEqual(chamadas.slice(antes), ["/api/v2/auth/access_token/get"]);
  const atual = await conta(t.id);
  assert.equal(decifrar(atual.refreshTokenEnc), "refresh-renovado");
  assert.notEqual(atual.refreshTokenEnc, antiga.refreshTokenEnc);
});

test("Shopee preserva a conexão anterior quando HTTP de erro contém tokens plausíveis", async () => {
  const t = await loja();
  prepararConexao("original");
  await conectar(t.id, "shopee", retorno("778899"), CALLBACK);
  const original = await conta(t.id);
  fila.push(Response.json({ access_token: "acesso-invalido", refresh_token: "refresh-invalido", expire_in: 14400 }, { status: 500 }));
  await assert.rejects(conectar(t.id, "shopee", retorno("998877"), CALLBACK));
  assert.deepEqual(await conta(t.id), original);
});

test("Shopee não cria conexão com validade expirada", async () => {
  const t = await loja();
  fila.push(Response.json({ access_token: "acesso-expirado", refresh_token: "refresh-expirado", expire_in: 0 }));
  await assert.rejects(conectar(t.id, "shopee", retorno("778899"), CALLBACK));
  assert.deepEqual(await contasDaLoja(t.id), []);
});

test("desconectar Shopee preserva credenciais da outra loja e não chama o provedor", async () => {
  const a = await loja();
  const b = await loja();
  prepararConexao("loja-a");
  await conectar(a.id, "shopee", retorno("111222"), CALLBACK);
  prepararConexao("loja-b");
  await conectar(b.id, "shopee", retorno("333444"), CALLBACK);
  const originalB = await conta(b.id);
  const antes = chamadas.length;
  await desconectar(a.id, "shopee");
  assert.deepEqual(await contasDaLoja(a.id), []);
  assert.deepEqual(await conta(b.id), originalB);
  assert.equal(chamadas.length, antes);
});
