import assert from "node:assert/strict";
import test from "node:test";
import { situacaoNaLista } from "./situacao-pedido";

const R = { AGUARDANDO_PAGAMENTO: "Aguardando pagamento", PAGO: "Pago, separar" };

test("Pix avisado e não conferido vira 'Pix a conferir'", () => {
  assert.deepEqual(situacaoNaLista({ status: "AGUARDANDO_PAGAMENTO", pixAConferir: true }, R), { rotulo: "Pix a conferir", pixAConferir: true });
});

test("sem aviso, ou já pago, segue o rótulo da situação", () => {
  assert.deepEqual(situacaoNaLista({ status: "AGUARDANDO_PAGAMENTO" }, R), { rotulo: "Aguardando pagamento", pixAConferir: false });
  assert.deepEqual(situacaoNaLista({ status: "PAGO", pixAConferir: true }, R), { rotulo: "Pago, separar", pixAConferir: false });
  assert.deepEqual(situacaoNaLista({ status: "OUTRO" }, R), { rotulo: "OUTRO", pixAConferir: false });
});
