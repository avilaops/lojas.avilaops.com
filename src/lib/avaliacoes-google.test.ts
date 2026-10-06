import assert from "node:assert/strict";
import test from "node:test";
import { conviteAvaliacao, somarDiasUteis } from "./avaliacoes-google";

const loja = { googleMerchantId: "5839051326", despachoDiasUteis: 1 };
const pedido = (extra: Record<string, unknown> = {}) => ({
  referencia: "ref-1", status: "PAGO", canal: "loja", clienteEmail: "ana@exemplo.com", fretePrazoDiasUteis: 5,
  // Terça-feira.
  criadoEm: new Date("2026-10-06T15:00:00Z"), ...extra,
});

test("dias úteis pulam o fim de semana", () => {
  assert.equal(somarDiasUteis(new Date("2026-10-09T23:30:00Z"), 1).toISOString().slice(0, 10), "2026-10-12");
  assert.equal(somarDiasUteis(new Date("2026-10-06T00:00:00Z"), 0).toISOString().slice(0, 10), "2026-10-06");
});

test("convite soma o despacho da loja ao prazo do frete", () => {
  const c = conviteAvaliacao(loja, pedido());
  // 6 dias úteis a partir de terça 06/10: quarta 14/10.
  assert.deepEqual(c, { merchantId: "5839051326", pedido: "ref-1", email: "ana@exemplo.com", entregaEstimada: "2026-10-14" });
});

test("sem conta, sem pagamento, fora da loja ou sem prazo, não há convite", () => {
  assert.equal(conviteAvaliacao({ ...loja, googleMerchantId: null }, pedido()), null);
  assert.equal(conviteAvaliacao({ ...loja, googleMerchantId: "abc" }, pedido()), null);
  assert.equal(conviteAvaliacao(loja, pedido({ status: "AGUARDANDO_PAGAMENTO" })), null);
  assert.equal(conviteAvaliacao(loja, pedido({ status: "ESTORNADO" })), null);
  assert.equal(conviteAvaliacao(loja, pedido({ canal: "mercadolivre" })), null);
  // Pedido anterior à coluna: sem prazo, não se inventa data.
  assert.equal(conviteAvaliacao(loja, pedido({ fretePrazoDiasUteis: null })), null);
});
