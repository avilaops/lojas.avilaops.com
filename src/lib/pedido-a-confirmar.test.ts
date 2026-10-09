import assert from "node:assert/strict";
import test from "node:test";
import { destinoAposFalhaDoCheckout, telaSemPedido } from "./pedido-a-confirmar";

test("pagamento a confirmar leva à página do pedido, pela referência que o servidor devolveu", () => {
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar", referencia: "LOJA-ABC-1" }, "LOJA-XYZ-9"), "/pedido/LOJA-ABC-1");
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar", referencia: "" }, "LOJA-XYZ-9"), "/pedido/LOJA-XYZ-9");
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar" }, "LOJA-XYZ-9"), "/pedido/LOJA-XYZ-9");
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar", referencia: "a/../b?x" }, "r"), "/pedido/a%2F..%2Fb%3Fx");
});

test("os demais erros do checkout ficam no formulário", () => {
  for (const corpo of [{ codigo: "falha_gateway" }, { codigo: "endereco_obrigatorio", erro: "Informe o endereço." }, { erro: "x" }, {}, null, undefined, "texto"]) {
    assert.equal(destinoAposFalhaDoCheckout(corpo, "LOJA-XYZ-9"), null, JSON.stringify(corpo));
  }
});

test("página do pedido sem pedido: a tentativa diz se está confirmando, se não concluiu ou se não existe", () => {
  for (const estado of ["INCERTA", "COBRANCA_CRIADA", "PAGA_SEM_PEDIDO"]) assert.equal(telaSemPedido(estado), "confirmando", estado);
  assert.equal(telaSemPedido("LIBERADA"), "nao_concluido");
  for (const estado of ["RESERVADA", "CONFIRMADA", "", null, undefined, "OUTRO"]) assert.equal(telaSemPedido(estado), null, String(estado));
});
