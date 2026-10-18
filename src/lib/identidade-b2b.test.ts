import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizarCnpjB2B,
  normalizarEmailB2B,
  validarOrcamentoB2B,
} from "./identidade-b2b";

test("CNPJ empresarial aceita máscara e persiste somente 14 dígitos", () => {
  assert.equal(normalizarCnpjB2B(" 60.067.738/0001-06 "), "60067738000106");
  assert.throws(() => normalizarCnpjB2B("123"), /14 dígitos/);
  assert.throws(() => normalizarCnpjB2B("00.000.000\/0000-00"), /inválido/);
});

test("e-mail do comprador é normalizado e endereço inválido é recusado", () => {
  assert.equal(normalizarEmailB2B(" Compras@Industria.COM.BR "), "compras@industria.com.br");
  assert.throws(() => normalizarEmailB2B("compras"), /e-mail inválido/i);
});

test("orçamento aceita zero e rejeita fração ou valor negativo", () => {
  assert.equal(validarOrcamentoB2B(0), 0);
  assert.equal(validarOrcamentoB2B(150_000), 150_000);
  assert.throws(() => validarOrcamentoB2B(-1), /inteiro não negativo/);
  assert.throws(() => validarOrcamentoB2B(1.5), /inteiro não negativo/);
});
