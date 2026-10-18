import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { criarTenant } from "../../src/lib/admin-tenants";
import { GET, POST } from "../../src/app/api/admin/tenants/[slug]/contratos/route";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
process.env.LOJAS_ADMIN_TOKEN = "token-de-teste-do-admin";
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);
const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) });
const request = (slug: string, method = "GET", body?: unknown) => new Request(`https://lojas.avilaops.com/api/admin/tenants/${slug}/contratos`, {
  method,
  headers: { authorization: "Bearer token-de-teste-do-admin", "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test("loja criada pelo admin nasce com contrato da tabela e comissão de 5%", async () => {
  const slug = `qa-contrato-${sufixo()}`;
  const tenant = await criarTenant({ slug, nome: "QA contrato", plano: "LOJA_PRO" });
  const contrato = await prisma.contratoComercial.findFirstOrThrow({ where: { tenantId: tenant.id } });
  assert.deepEqual(
    [contrato.versao, contrato.plano, contrato.mensalidadeCentavos, contrato.comissaoPontosBase, contrato.situacao],
    [1, "LOJA_PRO", 49700, 500, "ATIVO"],
  );
});

test("nova versão encerra a anterior, atualiza o plano e preserva o histórico", async () => {
  const slug = `qa-versao-${sufixo()}`;
  const tenant = await criarTenant({ slug, nome: "QA versão", plano: "LOJA" });
  const resposta = await POST(request(slug, "POST", {
    plano: "LOJA_PRO",
    mensalidadeCentavos: 35000,
    comissaoPontosBase: 300,
    origem: "CONTRATO_ASSINADO",
    aceiteReferencia: "documento-qa",
  }), contexto(slug));
  assert.equal(resposta.status, 201);

  const leitura = await GET(request(slug), contexto(slug));
  assert.equal(leitura.status, 200);
  const corpo = await leitura.json() as { vigente: { versao: number; comissaoPontosBase: number }; contratos: Array<{ versao: number; vigenteAte: string | null; situacao: string }> };
  assert.deepEqual([corpo.vigente.versao, corpo.vigente.comissaoPontosBase], [2, 300]);
  assert.deepEqual(corpo.contratos.map((c) => [c.versao, c.situacao, Boolean(c.vigenteAte)]), [[2, "ATIVO", false], [1, "ENCERRADO", true]]);
  assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).plano, "LOJA_PRO");
});

test("vigência duplicada ou futura é recusada sem criar outra versão", async () => {
  const slug = `qa-conflito-${sufixo()}`;
  const tenant = await criarTenant({ slug, nome: "QA conflito" });
  const atual = await prisma.contratoComercial.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const base = { plano: "LOJA" as const, mensalidadeCentavos: 26900, comissaoPontosBase: 500, origem: "QA" };
  assert.equal((await POST(request(slug, "POST", { ...base, vigenteDesde: atual.vigenteDesde.toISOString() }), contexto(slug))).status, 409);
  assert.equal((await POST(request(slug, "POST", { ...base, vigenteDesde: new Date(Date.now() + 86_400_000).toISOString() }), contexto(slug))).status, 422);
  assert.equal(await prisma.contratoComercial.count({ where: { tenantId: tenant.id } }), 1);
});
