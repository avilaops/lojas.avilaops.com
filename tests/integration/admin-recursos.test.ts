import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { GET, PATCH } from "../../src/app/api/admin/tenants/[slug]/route";
import { buscarTenantPorHost } from "../../src/lib/tenant";
import { recursoAtivo, RECURSOS } from "../../src/lib/recursos";

const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(banco.hostname) || banco.port !== "5548" || !banco.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}

const TOKEN = "token-sintetico-admin-recursos";
process.env.LOJAS_ADMIN_TOKEN = TOKEN;
const criadas: string[] = [];
after(async () => {
  try {
    await prisma.tenant.deleteMany({ where: { id: { in: criadas } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function loja(recursos = ["recebimento_v2", "pagamentos_pix_manual"]) {
  const t = await prisma.tenant.create({ data: {
    slug: `qa-rec-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    nome: "Loja de recursos QA", status: "ATIVA", recursos,
    senhaHash: "hash-sintetico-que-nao-deve-sair-na-api",
    melhorEnvioAccessTokenEnc: "segredo-cifrado-sintetico",
    melhorEnvioRefreshTokenEnc: "refresh-cifrado-sintetico",
  } });
  criadas.push(t.id);
  return t;
}

function requisicao(slug: string, metodo: string, corpo?: unknown, token: string | null = TOKEN) {
  return new Request(`https://lojas.example/api/admin/tenants/${slug}`, {
    method: metodo,
    headers: { "content-type": "application/json", ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
}

const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) });
const ler = (id: string) => prisma.tenant.findUniqueOrThrow({ where: { id } });
const alterar = (slug: string, corpo: unknown, token: string | null = TOKEN) => PATCH(requisicao(slug, "PATCH", corpo, token), contexto(slug));

test("admin persiste recursos de sandbox, preserva outros campos e a resolução por host enxerga a mudança", async () => {
  const t = await loja();
  const host = `${t.slug}.${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
  assert.deepEqual((await buscarTenantPorHost(host))?.recursos, t.recursos);
  const recursos = [...t.recursos, "frete_melhor_envio_sandbox"];
  assert.equal((await alterar(t.slug, { recursos })).status, 200);
  const atual = await ler(t.id);
  assert.deepEqual(atual.recursos, recursos);
  for (const [campo, valor] of Object.entries(t)) {
    if (campo !== "recursos" && campo !== "atualizadoEm") assert.deepEqual(atual[campo as keyof typeof atual], valor, campo);
  }
  assert.deepEqual((await buscarTenantPorHost(host))?.recursos, recursos);
  const resposta = await GET(requisicao(t.slug, "GET"), contexto(t.slug));
  assert.equal(resposta.status, 200);
  const publico = await resposta.json();
  assert.deepEqual(publico.recursos, recursos);
  assert.equal(Object.keys(publico).some((campo) => campo.endsWith("Enc")), false);
  assert.equal("senhaHash" in publico, false);
});

test("PATCH sem recursos preserva até códigos legados ignorados pelo runtime", async () => {
  const t = await loja(["recebimento_v2", "codigo_legado_qa"]);
  assert.equal((await alterar(t.slug, { nome: "Nome atualizado QA" })).status, 200);
  const atual = await ler(t.id);
  assert.equal(atual.nome, "Nome atualizado QA");
  assert.deepEqual(atual.recursos, t.recursos);
});

test("lista vazia revoga todos os recursos da loja escolhida", async () => {
  const t = await loja(["frete_melhor_envio_sandbox"]);
  assert.equal((await alterar(t.slug, { recursos: [] })).status, 200);
  const atual = await ler(t.id);
  assert.deepEqual(atual.recursos, []);
  assert.equal(recursoAtivo(atual, "frete_melhor_envio_sandbox", {}), false);
});

test("recursos inválidos recusam o PATCH inteiro, inclusive outros campos", async () => {
  const t = await loja();
  for (const recursos of [null, "recebimento_v2", ["recurso_inventado"], ["recebimento_v2", "RECEBIMENTO_V2"], [7], ["recebimento_v2", "recebimento_v2"], Array(RECURSOS.length + 1).fill("recebimento_v2")]) {
    const resposta = await alterar(t.slug, { recursos, nome: "Não deve ser salvo QA" });
    assert.equal(resposta.status, 422, JSON.stringify(recursos));
    assert.deepEqual(await ler(t.id), t);
  }
});

test("autenticação administrativa é exigida para leitura e alteração de recursos", async () => {
  const t = await loja();
  for (const token of [null, "token-sintetico-admin-incorreto"]) {
    assert.equal((await alterar(t.slug, { recursos: ["frete_melhor_envio_sandbox"] }, token)).status, 401);
    assert.equal((await GET(requisicao(t.slug, "GET", undefined, token), contexto(t.slug))).status, 401);
  }
  assert.deepEqual(await ler(t.id), t);
});

test("o slug da URL limita a alteração mesmo quando o corpo nomeia outra loja", async () => {
  const a = await loja();
  const b = await loja();
  assert.equal((await alterar(a.slug, { slug: b.slug, recursos: ["frete_melhor_envio_sandbox"] })).status, 200);
  assert.equal((await ler(a.id)).slug, a.slug);
  assert.deepEqual((await ler(a.id)).recursos, ["frete_melhor_envio_sandbox"]);
  assert.deepEqual(await ler(b.id), b);
  assert.equal((await alterar(`qa-ausente-${randomUUID()}`, { recursos: [] })).status, 404);
});

test("o bloqueio global prevalece sobre recurso habilitado pela API", async () => {
  const t = await loja([]);
  assert.equal((await alterar(t.slug, { recursos: ["frete_melhor_envio_sandbox"] })).status, 200);
  const atual = await ler(t.id);
  assert.equal(recursoAtivo(atual, "frete_melhor_envio_sandbox", {}), true);
  assert.equal(recursoAtivo(atual, "frete_melhor_envio_sandbox", { LOJAS_RECURSOS_DESLIGADOS: "frete_melhor_envio_sandbox" }), false);
});
