import assert from "node:assert/strict";
import { test } from "node:test";

import { lerTokenDeCadastro, planoDoCadastro, precisaDosPrimeirosPassos, tokenDeCadastro } from "./cadastro";
import { emailDoIdToken } from "./google-entrada";
import { lerTokenDeRecuperacao, tokenDeRecuperacao } from "./recuperacao";

// Os três leem o ambiente na hora da chamada, não no import.
process.env.LOJAS_SECRET ||= "a".repeat(64);
process.env.GOOGLE_CLIENT_ID = "cliente.apps.googleusercontent.com";

test("o link de cadastro leva o e-mail normalizado e o plano, e vence em 24 h", () => {
  const agora = Date.UTC(2026, 9, 6);
  const token = tokenDeCadastro("  Dono@Loja.COM ", "SITE", agora);
  assert.deepEqual(lerTokenDeCadastro(token, agora + 3_600_000), { email: "dono@loja.com", plano: "SITE" });
  assert.deepEqual(lerTokenDeCadastro(token, agora + 25 * 3_600_000), { erro: "expirado" });
});

test("link adulterado ou de outro propósito não vale como cadastro", () => {
  const token = tokenDeCadastro("a@b.com");
  const [corpo] = token.split(".");
  const outro = Buffer.from(JSON.stringify({ email: "intruso@b.com", exp: Date.now() + 1e6 })).toString("base64url");
  assert.deepEqual(lerTokenDeCadastro(`${outro}.${token.split(".")[1]}`), { erro: "invalido" });
  assert.deepEqual(lerTokenDeCadastro(corpo), { erro: "invalido" });
  // Mesmo segredo, prefixo diferente: o link de senha nova não abre conta.
  assert.deepEqual(lerTokenDeCadastro(tokenDeRecuperacao("loja", null)), { erro: "invalido" });
  assert.ok("slug" in lerTokenDeRecuperacao(tokenDeRecuperacao("loja", null)));
});

test("plano estranho no link vira nenhum plano", () => {
  assert.equal(planoDoCadastro("LOJA_PRO"), "LOJA_PRO");
  assert.equal(planoDoCadastro("GRATIS"), undefined);
  assert.equal(planoDoCadastro(3), undefined);
});

test("primeiros passos só para a conta que ainda não virou loja", () => {
  assert.equal(precisaDosPrimeirosPassos({ status: "PROVISIONANDO", whatsapp: null }), true);
  assert.equal(precisaDosPrimeirosPassos({ status: "PROVISIONANDO", whatsapp: "5516999990000" }), false);
  assert.equal(precisaDosPrimeirosPassos({ status: "ATIVA", whatsapp: null }), false);
});

test("o Google só vale com e-mail verificado, para este cliente e dentro da validade", () => {
  const agora = Date.UTC(2026, 9, 6);
  const idToken = (dados: Record<string, unknown>) =>
    ["x", Buffer.from(JSON.stringify(dados)).toString("base64url"), "y"].join(".");
  const base = { aud: "cliente.apps.googleusercontent.com", iss: "https://accounts.google.com", exp: agora / 1000 + 600, email: "Dono@Gmail.com", email_verified: true };
  assert.equal(emailDoIdToken(idToken(base), agora), "dono@gmail.com");
  assert.equal(emailDoIdToken(idToken({ ...base, email_verified: false }), agora), null);
  assert.equal(emailDoIdToken(idToken({ ...base, aud: "outro" }), agora), null);
  assert.equal(emailDoIdToken(idToken({ ...base, iss: "https://evil.example" }), agora), null);
  assert.equal(emailDoIdToken(idToken({ ...base, exp: agora / 1000 - 1 }), agora), null);
});
