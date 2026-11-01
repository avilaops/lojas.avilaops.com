import assert from "node:assert/strict";
import test from "node:test";
import { ehRecurso, meiosAceitos, pixNaConta, rotuloDosMeios, recursoAtivo, recursosAtivos } from "./recursos";

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

test("configurador sob medida pode ser ligado por loja e desligado globalmente", () => {
  const loja = { recursos: ["configurador_sob_medida"] };
  assert.equal(recursoAtivo(loja, "configurador_sob_medida", {}), true);
  assert.equal(recursoAtivo(loja, "configurador_sob_medida", { LOJAS_RECURSOS_DESLIGADOS: "configurador_sob_medida" }), false);
});

test("Pix na conta da loja só oferece Pix; sem o recurso, valem os meios da loja", () => {
  const meios = ["pix", "cartao", "boleto"];
  const ligado = { provedorPadrao: "pix_manual", recursos: ["pagamentos_pix_manual"], meiosPagamento: meios };
  assert.equal(pixNaConta(ligado), true);
  assert.deepEqual(meiosAceitos(ligado), ["pix"]);
  assert.deepEqual(meiosAceitos({ ...ligado, recursos: [] }), meios);
  assert.deepEqual(meiosAceitos({ ...ligado, provedorPadrao: "mercadopago" }), meios);
});

test("rótulo dos meios segue o que a loja aceita", () => {
  assert.equal(rotuloDosMeios(["pix", "cartao", "boleto"]), "Pix, cartão e boleto.");
  assert.equal(rotuloDosMeios(["boleto", "pix"]), "Pix e boleto.");
  assert.equal(rotuloDosMeios(["cartao"]), "Cartão.");
  assert.equal(rotuloDosMeios([]), "Nenhum meio de pagamento ligado.");
  const pixNaContaLigado = { provedorPadrao: "pix_manual", recursos: ["pagamentos_pix_manual"], meiosPagamento: ["pix", "cartao", "boleto"] };
  assert.equal(rotuloDosMeios(meiosAceitos(pixNaContaLigado)), "Pix.");
});
