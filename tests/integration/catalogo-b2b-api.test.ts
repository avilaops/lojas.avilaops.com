import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { GET as listar, POST as criar } from "../../src/app/api/admin/tenants/[slug]/catalogos-b2b/route";
import { GET as obter } from "../../src/app/api/admin/tenants/[slug]/catalogos-b2b/[catalogoId]/route";
import { POST as aprovar } from "../../src/app/api/admin/tenants/[slug]/catalogos-b2b/[catalogoId]/aprovar/route";
import { POST as importar } from "../../src/app/api/admin/tenants/[slug]/catalogos-b2b/importar/route";
import { POST as resolver } from "../../src/app/api/admin/tenants/[slug]/catalogos-b2b/resolver/route";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
process.env.LOJAS_ADMIN_TOKEN = "token-catalogo-b2b";
after(() => prisma.$disconnect());
const chave = () => randomUUID().replace(/-/g, "");
const req = (url: string, method = "GET", body?: unknown, token = "token-catalogo-b2b") => new Request(url, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function contexto() {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-api-cat-${chave()}`, nome: "QA API", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Cliente" } });
  const unidade = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" } });
  const produto = await prisma.produto.create({ data: { tenantId: tenant.id, slug: `produto-${chave()}`, nome: "Produto", sku: "PROD", precoCentavos: 1_000, variantes: { create: { padrao: true, valores: {}, nome: "Padrão", sku: "VAR", precoCentavos: 1_000 } } }, include: { variantes: true } });
  return { tenant, empresa, unidade, produto, variante: produto.variantes[0] };
}

const payload = (referencia = "tabela") => ({ referencia, nome: "Tabela", versao: 1, moeda: "BRL", vigenteDesde: "2026-10-01T00:00:00.000Z", vigenteAte: null, atribuicoes: [{ empresaReferencia: "cliente", unidadeReferencia: "matriz", prioridade: 0 }], itens: [{ produtoReferencia: "PROD", varianteReferencia: "VAR", acao: "INCLUIR", estrategiaPreco: "FIXO", precoFixoCentavos: 900, quantidadeMinima: 1, quantidadeMaxima: null, multiploVenda: 1, quantidadePorEmbalagem: 1, unidadeComercial: "UN", unidadesBaseNumerador: 1, unidadesBaseDenominador: 1, componentes: [] }] });

test("exige autenticação, valida loja e faz CRUD, aprovação e resolução", async () => {
  const c = await contexto();
  const base = `https://lojas.avilaops.com/api/admin/tenants/${c.tenant.slug}/catalogos-b2b`;
  assert.equal((await listar(req(base, "GET", undefined, "errado"), { params: Promise.resolve({ slug: c.tenant.slug }) })).status, 401);
  assert.equal((await listar(req(base), { params: Promise.resolve({ slug: "inexistente" }) })).status, 404);

  const criada = await criar(req(base, "POST", payload()), { params: Promise.resolve({ slug: c.tenant.slug }) });
  assert.equal(criada.status, 201);
  const catalogo = await criada.json() as { id: string };
  assert.equal((await listar(req(base), { params: Promise.resolve({ slug: c.tenant.slug }) })).status, 200);
  assert.equal((await obter(req(`${base}/${catalogo.id}`), { params: Promise.resolve({ slug: c.tenant.slug, catalogoId: catalogo.id }) })).status, 200);

  const aprovada = await aprovar(req(`${base}/${catalogo.id}/aprovar`, "POST", { versao: 1, ator: "qa" }), { params: Promise.resolve({ slug: c.tenant.slug, catalogoId: catalogo.id }) });
  assert.equal(aprovada.status, 200);
  const resolvida = await resolver(req(`${base}/resolver`, "POST", { empresaId: c.empresa.id, unidadeId: c.unidade.id, produtoId: c.produto.id, varianteId: c.variante.id, quantidade: 2, agora: "2026-10-18T00:00:00.000Z" }), { params: Promise.resolve({ slug: c.tenant.slug }) });
  assert.equal(resolvida.status, 200);
  assert.equal(((await resolvida.json()) as { oferta: { tipo: string } }).oferta.tipo, "OFERTA_B2B");
});

test("IDs de outra loja não atravessam nenhuma rota de item", async () => {
  const [a, b] = [await contexto(), await contexto()];
  const baseA = `https://x/api/admin/tenants/${a.tenant.slug}/catalogos-b2b`;
  const criada = await criar(req(baseA, "POST", payload()), { params: Promise.resolve({ slug: a.tenant.slug }) });
  const catalogo = await criada.json() as { id: string };
  const baseB = `https://x/api/admin/tenants/${b.tenant.slug}/catalogos-b2b`;
  assert.equal((await obter(req(`${baseB}/${catalogo.id}`), { params: Promise.resolve({ slug: b.tenant.slug, catalogoId: catalogo.id }) })).status, 404);
  assert.equal((await aprovar(req(`${baseB}/${catalogo.id}/aprovar`, "POST", { versao: 1, ator: "qa" }), { params: Promise.resolve({ slug: b.tenant.slug, catalogoId: catalogo.id }) })).status, 404);
  const resposta = await resolver(req(`${baseB}/resolver`, "POST", { empresaId: a.empresa.id, unidadeId: a.unidade.id, produtoId: a.produto.id, varianteId: a.variante.id, quantidade: 1 }), { params: Promise.resolve({ slug: b.tenant.slug }) });
  assert.equal(resposta.status, 422);
});

test("importação mantém cada agregado atômico e separa gravados de rejeitados", async () => {
  const c = await contexto();
  const base = `https://x/api/admin/tenants/${c.tenant.slug}/catalogos-b2b/importar`;
  const resposta = await importar(req(base, "POST", { catalogos: [payload("valido"), { ...payload("invalido"), moeda: "USD" }] }), { params: Promise.resolve({ slug: c.tenant.slug }) });
  assert.equal(resposta.status, 200);
  const corpo = await resposta.json() as { gravados: Array<{ referencia: string }>; rejeitados: Array<{ referencia: string; motivo: string }> };
  assert.deepEqual(corpo.gravados.map((x) => x.referencia), ["valido"]);
  assert.deepEqual(corpo.rejeitados.map((x) => x.referencia), ["invalido"]);
  assert.equal(await prisma.catalogoB2B.count({ where: { tenantId: c.tenant.id } }), 1);
});
