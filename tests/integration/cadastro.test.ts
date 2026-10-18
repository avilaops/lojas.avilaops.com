import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { concluirPrimeirosPassos, criarConta, precisaDosPrimeirosPassos } from "../../src/lib/cadastro";
import { DIAS_DE_TESTE, fimDoTeste } from "../../src/lib/planos";
import { conferirSenha } from "../../src/lib/sessao";
import { autenticar } from "../../src/lib/operadores";

/**
 * Cadastro por conta contra o Postgres de verdade: a conta nasce fora do ar,
 * o e-mail não abre duas contas e o endereço definitivo não pisa em outra loja.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);

test("a conta nasce fora do ar, com senha, plano do link e teste de 7 dias", async () => {
  const email = `QA-${sufixo()}@Cadastro.Example`;
  const agora = new Date(Date.UTC(2026, 9, 6, 12));
  const conta = await criarConta({ email, senha: "senha-forte-1", plano: "SITE" }, agora);
  assert.ok(conta);
  assert.equal(conta.status, "PROVISIONANDO");
  assert.equal(conta.loginEmail, email.toLowerCase());
  assert.equal(conta.plano, "SITE");
  assert.match(conta.slug, /^nova-[0-9a-f]{10}$/);
  assert.ok(conferirSenha("senha-forte-1", conta.senhaHash));
  assert.equal(fimDoTeste(conta).getTime() - agora.getTime(), DIAS_DE_TESTE * 86_400_000);
  assert.equal(precisaDosPrimeirosPassos(conta), true);
  assert.equal(await prisma.contratoComercial.count({ where: { tenantId: conta.id } }), 0);
});

test("o mesmo e-mail não abre duas contas, nem em dois cliques ao mesmo tempo", async () => {
  const email = `qa-${sufixo()}@cadastro.example`;
  const [a, b] = await Promise.all([criarConta({ email, senha: "senha-forte-1" }), criarConta({ email, senha: null })]);
  assert.equal([a, b].filter(Boolean).length, 1);
  assert.equal(await criarConta({ email: email.toUpperCase(), senha: "outra-senha-1" }), null);
});

test("primeiros passos põem a loja no ar com endereço que não pisa em outra", async () => {
  const nome = `Padaria QA ${sufixo()}`;
  const primeira = await concluirPrimeirosPassos((await criarConta({ email: `qa-${sufixo()}@cadastro.example`, senha: null }))!, { nome, whatsapp: "5516999990000", plano: "LOJA", aceitouTermosComerciais: true });
  const segunda = await concluirPrimeirosPassos((await criarConta({ email: `qa-${sufixo()}@cadastro.example`, senha: null }))!, { nome, whatsapp: "5516999990001", plano: "LOJA_PRO", aceitouTermosComerciais: true });
  assert.equal(primeira.status, "ATIVA");
  assert.equal(primeira.nome, nome);
  assert.ok(primeira.slug.startsWith("padaria-qa-"));
  assert.notEqual(primeira.slug, segunda.slug);
  assert.ok(segunda.slug.startsWith(primeira.slug));
  assert.equal(segunda.plano, "LOJA_PRO");
  const contratoPrimeira = await prisma.contratoComercial.findFirstOrThrow({ where: { tenantId: primeira.id } });
  const contratoSegunda = await prisma.contratoComercial.findFirstOrThrow({ where: { tenantId: segunda.id } });
  assert.deepEqual(
    [contratoPrimeira.plano, contratoPrimeira.mensalidadeCentavos, contratoPrimeira.comissaoPontosBase],
    ["LOJA", 26900, 500],
  );
  assert.equal(contratoPrimeira.aceiteReferencia, "termos-comerciais-v1:checkbox");
  assert.ok(contratoPrimeira.aceiteEm);
  assert.deepEqual(
    [contratoSegunda.plano, contratoSegunda.mensalidadeCentavos, contratoSegunda.comissaoPontosBase],
    ["LOJA_PRO", 49700, 500],
  );
  assert.equal(precisaDosPrimeirosPassos(primeira), false);
});

test("loja anterior à coluna segue com 14 dias contados da criação", async () => {
  const antiga = await prisma.tenant.create({ data: { slug: `qa-antiga-${sufixo()}`, nome: "QA antiga", status: "ATIVA", criadoEm: new Date(Date.UTC(2026, 8, 1)) } });
  assert.equal(antiga.testeAte, null);
  assert.equal(fimDoTeste(antiga).toISOString(), new Date(Date.UTC(2026, 8, 15)).toISOString());
});

test("quem se cadastrou sai e entra de novo com a mesma senha, digitando o e-mail como quiser", async () => {
  // Cadastro, logout e nova entrada: o caminho que a entrada do painel faz
  // (`/api/painel/entrar` procura a loja pelo e-mail e confere com `autenticar`).
  const email = `qa-${sufixo()}@cadastro.example`;
  const conta = await criarConta({ email, senha: "senha-forte-1" });
  assert.ok(conta);
  const digitado = `  ${email.toUpperCase()} `;
  const loja = await prisma.tenant.findUnique({ where: { loginEmail: digitado.trim().toLowerCase() } });
  assert.ok(loja);
  const quem = await autenticar(loja, digitado, "senha-forte-1");
  assert.equal(quem?.papel, "DONO");
  assert.equal(quem?.tenant.id, conta.id);
  assert.equal(await autenticar(loja, email, "senha-errada-1"), null);
});
