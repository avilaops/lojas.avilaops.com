import assert from "node:assert/strict";
import test from "node:test";
import { ehNotificacao, erroRpc, negociarVersao } from "./mcp-protocolo";

test("versão conhecida é devolvida; desconhecida ou ausente recebe a nossa mais nova", () => {
  assert.equal(negociarVersao("2024-11-05"), "2024-11-05");
  assert.equal(negociarVersao("2025-03-26"), "2025-03-26");
  assert.equal(negociarVersao("2099-01-01"), "2025-06-18");
  assert.equal(negociarVersao(undefined), "2025-06-18");
});

test("mensagem sem id é notificação, mesmo com id nulo sendo requisição", () => {
  assert.equal(ehNotificacao({ method: "notifications/initialized" }), true);
  assert.equal(ehNotificacao({ id: 1, method: "tools/list" }), false);
  assert.equal(ehNotificacao({ id: null, method: "tools/list" }), false);
  assert.equal(ehNotificacao({}), false);
});

test("erro de protocolo sempre leva id, nulo quando não se sabe", () => {
  assert.deepEqual(erroRpc(undefined, -32700, "Parse error"), { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  assert.equal(erroRpc(7, -32601, "x").id, 7);
});
