import assert from "node:assert/strict";
import { test } from "node:test";
import { paraMilimetros, prepararBuscaMedida } from "./busca-medida";

test("vírgula e ponto geram a mesma faixa aproximada", () => {
  assert.deepEqual(prepararBuscaMedida({ di: "50,8", de: "63.5", alt: "9,52" }), {
    ok: true, query: "di_de=50.3&di_ate=51.3&de_de=63&de_ate=64&alt_de=9.02&alt_ate=10.02",
  });
  assert.equal(paraMilimetros("50,8"), paraMilimetros("50.8"));
});

test("campo inválido bloqueia a busca mesmo com outra medida válida", () => {
  const resultado = prepararBuscaMedida({ di: "50,8", de: "abc" });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.equal(resultado.campo, "de");
});

test("busca parcial é permitida e limite inferior nunca fica negativo", () => {
  assert.deepEqual(prepararBuscaMedida({ alt: "0,1" }), { ok: true, query: "alt_de=0&alt_ate=0.6" });
  assert.equal(prepararBuscaMedida({ di: " " }).ok, false);
});

test("rejeita formatos ambíguos e valores fora dos limites", () => {
  for (const valor of ["abc", "1,2.3", "1e2", "0x10", "Infinity", "0", "-1", "10000"]) {
    assert.equal(paraMilimetros(valor), null, valor);
  }
});
