import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "../../src/lib/db";
import { criarLojaPeloSSO, emitirSelo } from "../../src/lib/sso-cadastro";
import { criarConta } from "../../src/lib/cadastro";
import { identificarPorEmail } from "../../src/lib/operadores";
import { consultarSSO, destinoDaEntradaSSO, lerRespostaSSO, CAMINHO_CRIAR_SSO } from "../../src/lib/sso";

process.env.LOJAS_SECRET ??= "0".repeat(64);

/**
 * Cliente novo do login social (Google, Microsoft, Facebook, GitHub no Auth)
 * cria a loja pelo Lojas e volta a entrar só pelo login único, contra o
 * Postgres de verdade. O Auth é simulado pela resposta do /api/session.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const cfg = { url: "https://auth.teste.local", app: "lojas-avilaops-com" };
const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);
const sessaoDoAuth = (email: string | null) =>
  lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { ...(email ? { email } : {}), nome: "QA", papel: "CLIENTE" } });
const aoEntrar = async (r: ReturnType<typeof sessaoDoAuth>, jaVoltou = true) => {
  const quem = r.tipo === "ok" ? await identificarPorEmail(r.email) : null;
  return { quem, destino: destinoDaEntradaSSO(r, { temLoja: !!quem, equipe: false, jaVoltou, urlLogin: "https://auth.teste.local/login" }) };
};

test("e-mail social novo: confirma, a loja nasce sem senha, sai e entra de novo pelo login único", async () => {
  const email = `QA-${sufixo()}@Social.Example`;
  const r = sessaoDoAuth(email);

  const primeira = await aoEntrar(r);
  assert.equal(primeira.destino, CAMINHO_CRIAR_SSO);
  assert.equal(primeira.quem, null);

  const criada = await criarLojaPeloSSO(r, emitirSelo(email));
  assert.equal(criada.tipo, "criada");
  assert.ok(criada.tipo === "criada");
  assert.equal(criada.tenant.loginEmail, email.toLowerCase());
  assert.equal(criada.tenant.senhaHash, null);
  assert.equal(criada.tenant.status, "PROVISIONANDO");

  // Sair (a sessão do painel é só cookie) e entrar de novo: o login único acha a loja.
  const volta = await aoEntrar(sessaoDoAuth(email.toUpperCase()));
  assert.equal(volta.destino, "abrir");
  assert.equal(volta.quem?.tenant.id, criada.tenant.id);
  assert.equal(volta.quem?.papel, "DONO");

  // Segundo clique na confirmação não abre outra loja.
  const repetida = await criarLojaPeloSSO(r, emitirSelo(email));
  assert.equal(repetida.tipo, "existente");
  assert.equal(await prisma.tenant.count({ where: { loginEmail: email.toLowerCase() } }), 1);
});

test("a confirmação recusa selo de outro e-mail e sessão vencida, sem criar nada", async () => {
  const email = `qa-${sufixo()}@social.example`;
  assert.deepEqual(await criarLojaPeloSSO(sessaoDoAuth(email), emitirSelo(`outro-${email}`)), { tipo: "recusado", recado: "selo" });
  assert.deepEqual(await criarLojaPeloSSO(sessaoDoAuth(email), null), { tipo: "recusado", recado: "selo" });

  // Cookie vencido: o Auth responde 401 na hora da confirmação.
  const vencido = await consultarSSO(cfg, "aaa.bbb.ccc", (async () => new Response(JSON.stringify({ autenticado: false }), { status: 401 })) as typeof fetch);
  assert.equal(vencido.tipo, "sem_sessao");
  assert.deepEqual(await criarLojaPeloSSO(vencido, emitirSelo(email)), { tipo: "recusado", recado: "sem-sessao" });
  // E na entrada: vai ao login do Auth, e na volta para com recado, sem laço.
  assert.equal((await aoEntrar(vencido as never, false)).destino, "https://auth.teste.local/login");
  assert.equal((await aoEntrar(vencido as never, true)).destino, "/entrar?sso=indisponivel");
  assert.equal(await prisma.tenant.count({ where: { loginEmail: email } }), 0);
});

test("e-mail social diferente do e-mail da loja vai à confirmação, que explica, e não mexe na loja existente", async () => {
  const daLoja = `qa-${sufixo()}@loja.example`;
  const loja = await criarConta({ email: daLoja, senha: "senha-forte-1" });
  assert.ok(loja);
  const social = sessaoDoAuth(`qa-${sufixo()}@gmail.example`);
  const r = await aoEntrar(social);
  assert.equal(r.destino, CAMINHO_CRIAR_SSO);
  assert.notEqual(r.destino, "/entrar?sso=sem-loja");
  assert.equal((await prisma.tenant.findUnique({ where: { id: loja.id } }))?.loginEmail, daLoja);
});

test("login social sem e-mail recebe recado próprio e não cria loja", async () => {
  const r = sessaoDoAuth(null);
  assert.equal(r.tipo, "sem_email");
  assert.equal((await aoEntrar(r)).destino, "/entrar?sso=sem-email");
  assert.deepEqual(await criarLojaPeloSSO(r, "x.y"), { tipo: "recusado", recado: "sem-email" });
});
