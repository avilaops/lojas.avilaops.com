import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { GET as listar, POST as criar } from "../../src/app/api/admin/tenants/[slug]/empresas/route";
import { GET as obter, PATCH as atualizar } from "../../src/app/api/admin/tenants/[slug]/empresas/[empresaId]/route";
import { criarTenant } from "../../src/lib/admin-tenants";
import { prisma } from "../../src/lib/db";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
process.env.LOJAS_ADMIN_TOKEN = "token-admin-b2b";
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);
const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) });
const contextoItem = (slug: string, empresaId: string) => ({ params: Promise.resolve({ slug, empresaId }) });
const requisicao = (url: string, method = "GET", body?: unknown, autorizada = true) => new Request(url, {
  method,
  headers: {
    ...(autorizada ? { authorization: "Bearer token-admin-b2b" } : {}),
    "content-type": "application/json",
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const entrada = (s: string) => ({
  referencia: `aurora-${s}`,
  razaoSocial: "Indústria Aurora Ltda",
  nomeFantasia: "Aurora",
  unidades: [{
    referencia: "matriz",
    nome: "Matriz",
    cnpj: "60067738000106",
    enderecos: [{ tipo: "FISCAL", cep: "14010000", logradouro: "Rua Um", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", principal: true }],
  }],
  contatos: [{ tipo: "COMERCIAL", nome: "Ana", email: `ana-${s}@aurora.test`, referenciaUnidade: "matriz" }],
  centrosCusto: [{ codigo: "MANUT", nome: "Manutenção", orcamentoMensalCentavos: 200_000 }],
  compradores: [{
    nome: "Ana",
    email: `ana-${s}@aurora.test`,
    centrosCusto: ["MANUT"],
    autorizacoes: [{ papel: "APROVADOR", referenciaUnidade: "matriz", limiteAprovacaoCentavos: 150_000 }],
  }],
});

test("API exige administração e valida o agregado antes de gravar", async () => {
  const slug = `qa-api-b2b-auth-${sufixo()}`;
  await criarTenant({ slug, nome: "QA API auth" });
  const endpoint = `https://lojas.avilaops.com/api/admin/tenants/${slug}/empresas`;
  assert.equal((await listar(requisicao(endpoint, "GET", undefined, false), contexto(slug))).status, 401);
  assert.equal((await criar(requisicao(endpoint, "POST", { referencia: "incompleto" }), contexto(slug))).status, 422);
  assert.equal(await prisma.empresaB2B.count({ where: { tenant: { slug } } }), 0);
});

test("API cria, lista, lê e atualiza empresa sem escapar do tenant", async () => {
  const s = sufixo();
  const slug = `qa-api-b2b-${s}`;
  const outroSlug = `qa-api-b2b-outro-${s}`;
  await criarTenant({ slug, nome: "QA API" });
  await criarTenant({ slug: outroSlug, nome: "QA API outro" });
  const endpoint = `https://lojas.avilaops.com/api/admin/tenants/${slug}/empresas`;
  const corpo = entrada(s);
  const respostaCriacao = await criar(requisicao(endpoint, "POST", corpo), contexto(slug));
  assert.equal(respostaCriacao.status, 201);
  const criada = await respostaCriacao.json() as { id: string; referencia: string };

  const respostaLista = await listar(requisicao(endpoint), contexto(slug));
  assert.equal(respostaLista.status, 200);
  const lista = await respostaLista.json() as { empresas: Array<{ id: string; unidades: unknown[]; compradores: unknown[] }> };
  assert.equal(lista.empresas.length, 1);
  assert.deepEqual([lista.empresas[0].id, lista.empresas[0].unidades.length, lista.empresas[0].compradores.length], [criada.id, 1, 1]);

  const item = `${endpoint}/${criada.id}`;
  assert.equal((await obter(requisicao(item), contextoItem(slug, criada.id))).status, 200);
  assert.equal((await obter(requisicao(item.replace(slug, outroSlug)), contextoItem(outroSlug, criada.id))).status, 404);

  const respostaAtualizacao = await atualizar(requisicao(item, "PATCH", { ...corpo, razaoSocial: "Aurora Industrial S.A." }), contextoItem(slug, criada.id));
  assert.equal(respostaAtualizacao.status, 200);
  assert.equal((await respostaAtualizacao.json() as { razaoSocial: string }).razaoSocial, "Aurora Industrial S.A.");
  assert.equal(await prisma.empresaB2B.count({ where: { tenant: { slug }, referencia: corpo.referencia } }), 1);
});
