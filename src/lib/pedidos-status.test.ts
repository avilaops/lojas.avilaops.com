import assert from "node:assert/strict";
import test from "node:test";
import { transicaoPermitida } from "./pedidos-status";

test("o ciclo unificado aceita somente a próxima etapa operacional", () => {
  assert.equal(transicaoPermitida("COTADO", "APROVADO"), true);
  assert.equal(transicaoPermitida("APROVADO", "AGUARDANDO_PAGAMENTO"), true);
  assert.equal(transicaoPermitida("AGUARDANDO_PAGAMENTO", "PAGO"), true);
  assert.equal(transicaoPermitida("PAGO", "EM_SEPARACAO"), true);
  assert.equal(transicaoPermitida("EM_SEPARACAO", "ENVIADO"), true);
  assert.equal(transicaoPermitida("ENVIADO", "ENTREGUE"), true);
});

test("repetição é idempotente e não regride nem pula etapas", () => {
  assert.equal(transicaoPermitida("PAGO", "PAGO"), true);
  assert.equal(transicaoPermitida("ENVIADO", "PAGO"), false);
  assert.equal(transicaoPermitida("PAGO", "ENTREGUE"), false);
  assert.equal(transicaoPermitida("CANCELADO", "PAGO"), false);
});

test("cancelamento e estorno obedecem ao momento financeiro", () => {
  assert.equal(transicaoPermitida("COTADO", "CANCELADO"), true);
  assert.equal(transicaoPermitida("AGUARDANDO_PAGAMENTO", "CANCELADO"), true);
  assert.equal(transicaoPermitida("PAGO", "ESTORNADO"), true);
  assert.equal(transicaoPermitida("ENTREGUE", "ESTORNADO"), true);
  assert.equal(transicaoPermitida("AGUARDANDO_PAGAMENTO", "ESTORNADO"), false);
});
