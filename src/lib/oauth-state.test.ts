import assert from "node:assert/strict";
import test from "node:test";
import { emitirState, lerState } from "./oauth-state";

process.env.LOJAS_SECRET ??= "0".repeat(64);

/**
 * O `state` é o que impede a conta de um lojista de ser gravada na loja de
 * outro: o retorno do OAuth é uma rota só, e quem diz de quem é a autorização
 * é ele.
 */

test("state emitido volta com o slug da loja", () => {
  assert.equal(lerState("canal:shopee", emitirState("canal:shopee", "brilhax")), "brilhax");
});

test("state com o slug trocado é recusado", () => {
  const [, assinatura] = emitirState("canal:shopee", "brilhax").split(".");
  const forjado = Buffer.from(JSON.stringify({ slug: "vedashow", exp: Date.now() + 60_000 })).toString("base64url");
  assert.equal(lerState("canal:shopee", `${forjado}.${assinatura}`), null);
});

test("state de um serviço não vale no retorno de outro", () => {
  // Sem o propósito na assinatura, autorizar a Shopee renderia um `state`
  // aceito no retorno do Mercado Livre.
  const state = emitirState("canal:shopee", "brilhax");
  assert.equal(lerState("canal:mercadolivre", state), null);
  assert.equal(lerState("melhor-envio-oauth", state), null);
});

test("slug em claro, vazio e nulo não passam", () => {
  assert.equal(lerState("canal:mercadolivre", "brilhax"), null);
  assert.equal(lerState("canal:mercadolivre", ""), null);
  assert.equal(lerState("canal:mercadolivre", null), null);
  assert.equal(lerState("canal:mercadolivre", "a.b.c"), null);
});

test("state vencido é recusado", (t) => {
  const state = emitirState("canal:amazon", "brilhax");
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 16 * 60_000 });
  assert.equal(lerState("canal:amazon", state), null);
});
