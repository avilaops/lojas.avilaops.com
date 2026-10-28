import assert from "node:assert/strict";
import { test } from "node:test";
import { conferirAprovacaoCotacao, proximoEstadoCotacao, totaisCotacao } from "./cotacoes-b2b";

test("total usa centavos inteiros e recusa desconto superior ao subtotal", () => {
  assert.deepEqual(totaisCotacao([{ quantidade: 3, precoUnitarioCentavos: 1_001 }], 3, 100), { subtotalCentavos: 3_003, descontoCentavos: 3, freteCentavos: 100, totalCentavos: 3_100 });
  assert.throws(() => totaisCotacao([{ quantidade: 1, precoUnitarioCentavos: 10 }], 11, 0), /desconto/i);
});

test("totais recusam valores fora do limite persistível antes de gravar", () => {
  const maximo = 2_147_483_647;
  assert.equal(totaisCotacao([{ quantidade: 1, precoUnitarioCentavos: maximo }]).totalCentavos, maximo);
  assert.throws(() => totaisCotacao([{ quantidade: 2, precoUnitarioCentavos: maximo }]), /limite/i);
  assert.throws(() => totaisCotacao([{ quantidade: 1, precoUnitarioCentavos: maximo }], 0, 1), /limite/i);
  assert.throws(() => totaisCotacao([{ quantidade: 1, precoUnitarioCentavos: Number.MAX_SAFE_INTEGER }]), /limite/i);
});

test("aprovação respeita papel, escopo, alçada e exceção administrativa", () => {
  const base = { totalCentavos: 50_000, unidadeId: "u-1", excecaoComercial: false, justificativa: null };
  assert.doesNotThrow(() => conferirAprovacaoCotacao(base, [{ papel: "APROVADOR", unidadeId: "u-1", limiteAprovacaoCentavos: 50_000 }]));
  assert.throws(() => conferirAprovacaoCotacao(base, [{ papel: "APROVADOR", unidadeId: "u-2", limiteAprovacaoCentavos: 100_000 }]), /escopo/i);
  assert.throws(() => conferirAprovacaoCotacao(base, [{ papel: "APROVADOR", unidadeId: null, limiteAprovacaoCentavos: 49_999 }]), /alçada/i);
  assert.throws(() => conferirAprovacaoCotacao({ ...base, excecaoComercial: true, justificativa: "" }, [{ papel: "ADMINISTRADOR", unidadeId: null, limiteAprovacaoCentavos: null }]), /justificativa/i);
  assert.doesNotThrow(() => conferirAprovacaoCotacao({ ...base, excecaoComercial: true, justificativa: "Condição negociada" }, [{ papel: "ADMINISTRADOR", unidadeId: null, limiteAprovacaoCentavos: null }]));
  assert.throws(() => conferirAprovacaoCotacao({ ...base, excecaoComercial: true, justificativa: "Condição negociada" }, [{ papel: "APROVADOR", unidadeId: null, limiteAprovacaoCentavos: null }]), /administrador/i);
});

test("máquina de estados não permite pular submissão nem reabrir terminal", () => {
  assert.equal(proximoEstadoCotacao("RASCUNHO", "CONTRAPOR"), "EM_NEGOCIACAO");
  assert.equal(proximoEstadoCotacao("EM_NEGOCIACAO", "SUBMETER"), "AGUARDANDO_APROVACAO");
  assert.equal(proximoEstadoCotacao("AGUARDANDO_APROVACAO", "APROVAR"), "APROVADA");
  assert.equal(proximoEstadoCotacao("APROVADA", "CONVERTER"), "CONVERTIDA");
  assert.throws(() => proximoEstadoCotacao("RASCUNHO", "APROVAR"), /transição/i);
  assert.throws(() => proximoEstadoCotacao("CANCELADA", "CONTRAPOR"), /transição/i);
});
