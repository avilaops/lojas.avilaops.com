import assert from "node:assert/strict";
import test from "node:test";
import { emitirState, lerState, urlDeAutorizacao } from "./melhor-envio-conta";

// O módulo lê o ambiente na hora da chamada, não na importação.
process.env.LOJAS_SECRET ??= "0".repeat(64);
process.env.MELHOR_ENVIO_CLIENT_ID = "123";
delete process.env.MELHOR_ENVIO_URL;

/**
 * O `state` é o que impede a conta de um lojista de ser gravada na loja de
 * outro: o retorno do OAuth é uma rota só, e quem diz de quem é a autorização
 * é ele.
 */

test("state emitido volta com o slug da loja", () => {
  assert.equal(lerState(emitirState("brilhax")), "brilhax");
});

test("state com o slug trocado é recusado", () => {
  const [, assinatura] = emitirState("brilhax").split(".");
  const forjado = Buffer.from(JSON.stringify({ slug: "vedashow", exp: Date.now() + 60_000 })).toString("base64url");
  assert.equal(lerState(`${forjado}.${assinatura}`), null);
});

test("slug em claro, que era o state do Mercado Livre, não passa", () => {
  assert.equal(lerState("brilhax"), null);
  assert.equal(lerState(""), null);
  assert.equal(lerState(null), null);
});

test("state vencido é recusado", (t) => {
  const state = emitirState("brilhax");
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 16 * 60_000 });
  assert.equal(lerState(state), null);
});

test("a autorização pede só cotação e leitura da conta, e volta para o retorno da plataforma", () => {
  const url = new URL(urlDeAutorizacao("brilhax", "https://lojas.avilaops.com"));
  assert.equal(url.origin + url.pathname, "https://melhorenvio.com.br/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://lojas.avilaops.com/melhor-envio/callback");
  assert.equal(url.searchParams.get("scope"), "shipping-calculate users-read");
  assert.equal(lerState(url.searchParams.get("state")), "brilhax");
});
