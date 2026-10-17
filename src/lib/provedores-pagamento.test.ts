import assert from "node:assert/strict";
import test from "node:test";
import { provedoresDePagamento } from "./provedores-pagamento";

test("PagBank está registrado ao lado do Mercado Pago e expõe o Connect", () => {
  assert.equal(provedoresDePagamento.tem("pagbank"), true);
  assert.equal(provedoresDePagamento.tem("mercadopago"), true);
  const pagbank = provedoresDePagamento.obter("pagbank");
  assert.equal(pagbank.tipoConexao, "oauth");
  assert.equal(typeof pagbank.oauth?.urlDeAutorizacao, "function");
  assert.equal(typeof pagbank.oauth?.concluir, "function");
  assert.equal(pagbank.campos.length, 0);
  assert.equal(pagbank.guia.length, 0);
});
