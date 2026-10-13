import assert from "node:assert/strict";
import test from "node:test";

import { emitirSelo, origemConfere, seloConfere } from "./sso-cadastro";

process.env.LOJAS_SECRET ??= "0".repeat(64);

test("o selo da confirmação vale só para o e-mail do Auth e por pouco tempo", () => {
  const agora = Date.UTC(2026, 9, 13, 19);
  const selo = emitirSelo("Nova@Loja.Example ", agora);
  assert.equal(seloConfere(selo, "nova@loja.example", agora + 60_000), true);
  assert.equal(seloConfere(selo, "outra@loja.example", agora + 60_000), false);
  assert.equal(seloConfere(selo, "nova@loja.example", agora + 16 * 60_000), false);
  assert.equal(seloConfere(selo.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "nova@loja.example", agora), false);
  assert.equal(seloConfere(undefined, "nova@loja.example", agora), false);
  assert.equal(seloConfere("lixo", "nova@loja.example", agora), false);
});

test("a confirmação só aceita POST vindo da própria plataforma", () => {
  assert.equal(origemConfere("https://lojas.avilaops.com", "lojas.avilaops.com"), true);
  assert.equal(origemConfere("https://evil.example", "lojas.avilaops.com"), false);
  assert.equal(origemConfere("https://loja.lojas.avilaops.com", "lojas.avilaops.com"), false);
  assert.equal(origemConfere(null, "lojas.avilaops.com"), false);
  assert.equal(origemConfere("null", "lojas.avilaops.com"), false);
});
