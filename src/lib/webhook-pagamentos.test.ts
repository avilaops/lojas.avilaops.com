import assert from "node:assert/strict";
import test from "node:test";
import { chaveDaNotificacao } from "./webhook-pagamentos";

test("a chave muda com status e valor, e separa provedores", () => {
  const a = chaveDaNotificacao("pagbank", "1", "aprovado", 100);
  assert.notEqual(a, chaveDaNotificacao("pagbank", "1", "estornado", 100));
  assert.notEqual(a, chaveDaNotificacao("pagbank", "1", "aprovado", 50));
  assert.notEqual(a, chaveDaNotificacao("cielo", "1", "aprovado", 100));
});
