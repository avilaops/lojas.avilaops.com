import assert from "node:assert/strict";
import test from "node:test";
import { validarChavePix } from "./pix-chave.ts";

test("descobre o tipo e normaliza", () => {
  assert.deepEqual(validarChavePix(" Loja@Exemplo.com "), { ok: true, tipo: "email", chave: "loja@exemplo.com" });
  assert.deepEqual(validarChavePix("529.982.247-25"), { ok: true, tipo: "cpf", chave: "52998224725" });
  assert.deepEqual(validarChavePix("11.222.333/0001-81"), { ok: true, tipo: "cnpj", chave: "11222333000181" });
  assert.deepEqual(validarChavePix("+55 (11) 91234-5678"), { ok: true, tipo: "telefone", chave: "+5511912345678" });
  assert.deepEqual(validarChavePix("123E4567-E89B-12D3-A456-426614174000"), { ok: true, tipo: "aleatoria", chave: "123e4567-e89b-12d3-a456-426614174000" });
});

test("com tipo escolhido, confere contra ele e explica em português", () => {
  assert.deepEqual(validarChavePix("11912345678", "telefone"), { ok: true, tipo: "telefone", chave: "+5511912345678" });
  const r = validarChavePix("111.111.111-11", "cpf");
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.mensagem.includes("CPF"));
  assert.equal(validarChavePix("").ok, false);
  assert.equal(validarChavePix("isso não é chave").ok, false);
});
