import assert from "node:assert/strict";
import test from "node:test";
import { aplicativoConfigurado, conectadoPorOAuth, emitirState, lerState, urlDeAutorizacao } from "./mercado-pago-conta";
import { emitirState as emitirStateDoMelhorEnvio } from "./melhor-envio-conta";

// O módulo lê o ambiente na hora da chamada, não na importação.
process.env.LOJAS_SECRET ??= "0".repeat(64);
process.env.MP_APP_ID = "123";

/**
 * O `state` é o que impede a conta de um lojista de ser gravada na loja de
 * outro. Aqui o estrago seria o pior de todos: a venda de uma loja cairia na
 * conta do Mercado Pago de outra.
 */

test("state emitido volta com o slug da loja", () => {
  assert.equal(lerState(emitirState("vedashow")), "vedashow");
});

test("state com o slug trocado é recusado", () => {
  const [, assinatura] = emitirState("vedashow").split(".");
  const forjado = Buffer.from(JSON.stringify({ slug: "brilhax", exp: Date.now() + 60_000 })).toString("base64url");
  assert.equal(lerState(`${forjado}.${assinatura}`), null);
});

test("state de outra conexão não serve no retorno do Mercado Pago", () => {
  assert.equal(lerState(emitirStateDoMelhorEnvio("vedashow")), null);
});

test("state vencido é recusado", (t) => {
  const state = emitirState("vedashow");
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 16 * 60_000 });
  assert.equal(lerState(state), null);
});

test("a autorização vai para o Mercado Pago do Brasil e volta para o retorno da plataforma", () => {
  const url = new URL(urlDeAutorizacao("vedashow", "https://lojas.avilaops.com"));
  assert.equal(url.origin + url.pathname, "https://auth.mercadopago.com.br/authorization");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("platform_id"), "mp");
  assert.equal(url.searchParams.get("redirect_uri"), "https://lojas.avilaops.com/mercado-pago/callback");
  assert.equal(lerState(url.searchParams.get("state")), "vedashow");
});

test("o aplicativo só conta como configurado com as três variáveis", () => {
  process.env.MP_APP_SECRET = "segredo";
  delete process.env.MP_APP_WEBHOOK_SECRET;
  assert.equal(aplicativoConfigurado(), false);
  process.env.MP_APP_WEBHOOK_SECRET = "assinatura";
  assert.equal(aplicativoConfigurado(), true);
});

test("chave colada à mão não é conexão por OAuth", () => {
  assert.equal(conectadoPorOAuth({ mpAccessTokenEnc: "v1.x.y.z", mpRefreshTokenEnc: null }), false);
  assert.equal(conectadoPorOAuth({ mpAccessTokenEnc: "v1.x.y.z", mpRefreshTokenEnc: "v1.a.b.c" }), true);
});
