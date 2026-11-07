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

test("primeiros passos preservam contrato preexistente e registram a próxima versão", async () => {
  const conta = (await criarConta({ email: `qa-${sufixo()}@cadastro.example`, senha: null }))!;
  const anterior = await prisma.contratoComercial.create({
    data: { tenantId: conta.id, versao: 3, plano: "SITE", mensalidadeCentavos: 25000,
      comissaoPontosBase: 500, vigenteDesde: new Date("2026-01-01"), situacao: "ATIVO", origem: "ADMIN" },
  });
  const instante = new Date();
  const entrada = { nome: `Imperial QA ${sufixo()}`, whatsapp: "5516999990000", plano: "LOJA" as const, aceitouTermosComerciais: true as const };
  const loja = await concluirPrimeirosPassos(conta, entrada, instante);
  const contratos = await prisma.contratoComercial.findMany({ where: { tenantId: conta.id }, orderBy: { versao: "asc" } });
  assert.equal(loja.status, "ATIVA");
  assert.equal(contratos.length, 2);
  assert.equal(contratos[0].id, anterior.id);
  assert.equal(contratos[0].mensalidadeCentavos, 25000);
  assert.equal(contratos[0].situacao, "ENCERRADO");
  assert.equal(contratos[0].vigenteAte?.getTime(), instante.getTime());
  assert.equal(contratos[1].versao, 4);
  assert.equal(contratos[1].vigenteDesde.getTime(), instante.getTime());
  assert.equal(contratos[1].aceiteEm?.getTime(), instante.getTime());
  assert.equal(contratos[1].mensalidadeCentavos, 26900);
  // Reenvio com a conta antiga não altera a loja nem duplica o aceite.
  const repetida = await concluirPrimeirosPassos(conta, { ...entrada, nome: "Não substituir" });
  assert.equal(repetida.nome, loja.nome);
  assert.equal(await prisma.contratoComercial.count({ where: { tenantId: conta.id } }), 2);
});

test("dois envios simultâneos ativam a loja com um único contrato", async () => {
  const conta = (await criarConta({ email: `qa-${sufixo()}@cadastro.example`, senha: null }))!;
  const entrada = { nome: `Simultânea QA ${sufixo()}`, whatsapp: "5516999990000", plano: "SITE" as const, aceitouTermosComerciais: true as const };
  const [a, b] = await Promise.all([concluirPrimeirosPassos(conta, entrada), concluirPrimeirosPassos(conta, entrada)]);
  assert.equal(a.slug, b.slug);
  assert.equal(a.status, "ATIVA");
  assert.equal(await prisma.contratoComercial.count({ where: { tenantId: conta.id } }), 1);
});

test("conflito de vigência preserva os dados da conta e seu contrato", async () => {
  const conta = (await criarConta({ email: `qa-${sufixo()}@cadastro.example`, senha: null }))!;
  const instante = new Date();
  const contrato = await prisma.contratoComercial.create({
    data: { tenantId: conta.id, versao: 1, plano: "SITE", mensalidadeCentavos: 11000,
      comissaoPontosBase: 500, vigenteDesde: instante, situacao: "ATIVO", origem: "ADMIN" },
  });
  await assert.rejects(concluirPrimeirosPassos(conta, {
    nome: "Não gravar", whatsapp: "5516999990000", plano: "LOJA", aceitouTermosComerciais: true,
  }, instante), /vigência/);
  const preservada = await prisma.tenant.findUniqueOrThrow({ where: { id: conta.id } });
  assert.equal(preservada.slug, conta.slug);
  assert.equal(preservada.status, "PROVISIONANDO");
  assert.equal(preservada.whatsapp, null);
  assert.equal((await prisma.contratoComercial.findUniqueOrThrow({ where: { id: contrato.id } })).vigenteAte, null);
});
