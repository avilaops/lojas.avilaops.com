import test from "node:test";
import assert from "node:assert/strict";
import {
  dadosDoContratoPadrao,
  dadosDoContratoLegado,
  intervaloSobreposto,
  selecionarContratoVigente,
} from "./contratos-comerciais";

test("novo cadastro mantém a mensalidade do plano e recebe 5%", () => {
  assert.deepEqual(dadosDoContratoPadrao("SITE"), { plano: "SITE", mensalidadeCentavos: 11000, comissaoPontosBase: 500 });
  assert.deepEqual(dadosDoContratoPadrao("LOJA"), { plano: "LOJA", mensalidadeCentavos: 26900, comissaoPontosBase: 500 });
  assert.deepEqual(dadosDoContratoPadrao("LOJA_PRO"), { plano: "LOJA_PRO", mensalidadeCentavos: 49700, comissaoPontosBase: 500 });
});

test("legados preservam a regra, com as exceções aprovadas por slug", () => {
  assert.deepEqual(dadosDoContratoLegado({ slug: "cliente-antigo", plano: "LOJA", faixaPreco: null }), {
    plano: "LOJA", mensalidadeCentavos: 26900, comissaoPontosBase: 0,
  });
  assert.deepEqual(dadosDoContratoLegado({ slug: "vedashow", plano: "LOJA_PRO", faixaPreco: "loja-pro-350" }), {
    plano: "LOJA_PRO", mensalidadeCentavos: 35000, comissaoPontosBase: 500,
  });
  assert.deepEqual(dadosDoContratoLegado({ slug: "bereta-rodas", plano: "LOJA", faixaPreco: null }), {
    plano: "LOJA", mensalidadeCentavos: 26900, comissaoPontosBase: 300,
  });
});

test("intervalos tratam o fim como exclusivo e recusam sobreposição real", () => {
  const d = (dia: number) => new Date(Date.UTC(2026, 9, dia));
  assert.equal(intervaloSobreposto(d(1), d(10), d(10), null), false);
  assert.equal(intervaloSobreposto(d(1), d(11), d(10), null), true);
  assert.equal(intervaloSobreposto(d(1), null, d(10), d(20)), true);
});

test("seleção exige exatamente um contrato e nunca aplica fallback", () => {
  const instante = new Date("2026-10-18T12:00:00Z");
  const base = { vigenteDesde: new Date("2026-10-01T00:00:00Z"), vigenteAte: null };
  assert.equal(selecionarContratoVigente([], instante), null);
  assert.equal(selecionarContratoVigente([{ id: "c1", ...base }], instante)?.id, "c1");
  assert.throws(
    () => selecionarContratoVigente([{ id: "c1", ...base }, { id: "c2", ...base }], instante),
    /mais de um contrato comercial vigente/,
  );
});
