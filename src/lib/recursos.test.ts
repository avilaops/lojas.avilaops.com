import assert from "node:assert/strict";
import test from "node:test";
import { ehRecurso, meiosAceitos, pixNaConta, recursoAtivo, recursosAtivos } from "./recursos";

test("loja sem recursos segue igual: tudo desligado", () => {
  assert.equal(recursoAtivo({ recursos: [] }, "recebimento_v2", {}), false);
  assert.deepEqual(recursosAtivos({ recursos: [] }, {}), []);
});

test("recurso ligado na loja vale só para ela; nome desconhecido é ignorado", () => {
  const loja = { recursos: ["pagamentos_pagbank", "coisa_que_nao_existe"] };
  assert.equal(recursoAtivo(loja, "pagamentos_pagbank", {}), true);
  assert.equal(recursoAtivo(loja, "pagamentos_pix_manual", {}), false);
  assert.deepEqual(recursosAtivos(loja, {}), ["pagamentos_pagbank"]);
  assert.equal(ehRecurso("coisa_que_nao_existe"), false);
});

test("LOJAS_RECURSOS_DESLIGADOS desliga para todas", () => {
  const loja = { recursos: ["pagamentos_pagbank", "recebimento_v2"] };
  const env = { LOJAS_RECURSOS_DESLIGADOS: " pagamentos_pagbank ,x" };
  assert.equal(recursoAtivo(loja, "pagamentos_pagbank", env), false);
  assert.equal(recursoAtivo(loja, "recebimento_v2", env), true);
});

test("Pix na conta da loja só oferece Pix; sem o recurso, valem os meios da loja", () => {
  const meios = ["pix", "cartao", "boleto"];
  const ligado = { provedorPadrao: "pix_manual", recursos: ["pagamentos_pix_manual"], meiosPagamento: meios };
  assert.equal(pixNaConta(ligado), true);
  assert.deepEqual(meiosAceitos(ligado), ["pix"]);
  assert.deepEqual(meiosAceitos({ ...ligado, recursos: [] }), meios);
  assert.deepEqual(meiosAceitos({ ...ligado, provedorPadrao: "mercadopago" }), meios);
});
