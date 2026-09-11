import assert from "node:assert/strict";
import test from "node:test";
import { REENVIOS_MAXIMOS, VERSAO_CONTRATO, itensParaTexto, novoEventId } from "./eventos";

/**
 * O contrato com o n8n é o que não pode mudar por acidente: o fluxo vivo
 * valida `versao`, `eventId` e os campos por tipo, e um envelope diferente
 * cai em "Evento inválido" sem mandar nada.
 */
test("versão do contrato e formato do eventId são os que o fluxo espera", () => {
  assert.equal(VERSAO_CONTRATO, 1);
  assert.match(novoEventId(), /^evt_[0-9a-f]{32}$/);
  assert.notEqual(novoEventId(), novoEventId());
});

test("itensTexto é a forma que vai no WhatsApp", () => {
  assert.equal(itensParaTexto([{ nome: "Retentor", quantidade: 2, precoCentavos: 100 }, { nome: "Rolamento", quantidade: 1, precoCentavos: 200 }]), "2x Retentor, 1x Rolamento");
});

test("reenvio tem teto: depois dele é decisão humana", () => {
  assert.equal(REENVIOS_MAXIMOS, 3);
});
