import assert from "node:assert/strict";
import test from "node:test";
import { compraConfirmadaParaAnalytics } from "./pedido-compra-analytics";

for (const status of ["COTADO", "APROVADO", "AGUARDANDO_PAGAMENTO", "CANCELADO", "ESTORNADO", "NOVO_STATUS"]) {
  test(`pedido ${status} não registra uma compra no Analytics`, () => {
    assert.equal(compraConfirmadaParaAnalytics(status), false);
  });
}

for (const status of ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"]) {
  test(`pedido ${status} permite registrar a compra confirmada`, () => {
    assert.equal(compraConfirmadaParaAnalytics(status), true);
  });
}
