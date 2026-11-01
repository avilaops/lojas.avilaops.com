import assert from "node:assert/strict";
import test from "node:test";
import { lerUltimoCodigoRetomada, salvarUltimoCodigoRetomada, type ArmazenamentoRetomada } from "./configurador-retomada";

function memoria(): ArmazenamentoRetomada {
  const valores = new Map<string, string>();
  return {
    getItem: (chave) => valores.get(chave) ?? null,
    setItem: (chave, valor) => void valores.set(chave, valor),
  };
}

test("código de retomada fica separado por tenant", () => {
  const armazenamento = memoria();
  const codigo = "CFG-ABCDEFGHIJKL.abcdefghijklmnopqrstuv";

  assert.equal(salvarUltimoCodigoRetomada("mrg-caixas-termicas", codigo, armazenamento), true);
  assert.equal(lerUltimoCodigoRetomada("mrg-caixas-termicas", armazenamento), codigo);
  assert.equal(lerUltimoCodigoRetomada("outra-loja", armazenamento), null);
});

test("valor corrompido ou storage bloqueado não derruba o configurador", () => {
  const corrompido = memoria();
  corrompido.setItem("loja:mrg-caixas-termicas:configurador:retomada", "segredo-invalido");
  assert.equal(lerUltimoCodigoRetomada("mrg-caixas-termicas", corrompido), null);

  const bloqueado: ArmazenamentoRetomada = {
    getItem: () => { throw new Error("bloqueado"); },
    setItem: () => { throw new Error("bloqueado"); },
  };
  assert.equal(lerUltimoCodigoRetomada("mrg-caixas-termicas", bloqueado), null);
  assert.equal(salvarUltimoCodigoRetomada("mrg-caixas-termicas", "CFG-ABCDEFGHIJKL.abcdefghijklmnopqrstuv", bloqueado), false);
});
