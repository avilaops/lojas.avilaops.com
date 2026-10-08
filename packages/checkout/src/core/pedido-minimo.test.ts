import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avaliarPedidoMinimo, avisoDePedidoMinimo } from "./pedido-minimo.ts";

// O valor do mínimo é dado da loja. Os números daqui são só de teste.
const MINIMO = 12000;

// O `Intl` separa "R$" do número com espaço não separável; a comparação de
// texto não deve depender disso.
const plano = (texto: string | null) => texto?.replace(/\s/g, " ") ?? null;

describe("avaliarPedidoMinimo", () => {
  it("sem mínimo, qualquer pedido passa", () => {
    assert.deepEqual(avaliarPedidoMinimo(1, null), { minimo: null, atingido: true, falta: 0 });
    assert.deepEqual(avaliarPedidoMinimo(1, undefined), { minimo: null, atingido: true, falta: 0 });
  });

  it("zero, negativo e número quebrado valem como sem mínimo", () => {
    for (const estragado of [0, -500, 99.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(avaliarPedidoMinimo(1, estragado).minimo, null, String(estragado));
      assert.equal(avaliarPedidoMinimo(1, estragado).atingido, true, String(estragado));
    }
  });

  it("abaixo do mínimo diz quanto falta", () => {
    assert.deepEqual(avaliarPedidoMinimo(MINIMO - 2550, MINIMO), { minimo: MINIMO, atingido: false, falta: 2550 });
  });

  it("um centavo abaixo ainda não atinge", () => {
    assert.deepEqual(avaliarPedidoMinimo(MINIMO - 1, MINIMO), { minimo: MINIMO, atingido: false, falta: 1 });
  });

  it("exatamente o mínimo atinge", () => {
    assert.deepEqual(avaliarPedidoMinimo(MINIMO, MINIMO), { minimo: MINIMO, atingido: true, falta: 0 });
  });

  it("acima do mínimo não devolve falta negativa", () => {
    assert.deepEqual(avaliarPedidoMinimo(MINIMO * 3, MINIMO), { minimo: MINIMO, atingido: true, falta: 0 });
  });

  it("carrinho vazio falta o mínimo inteiro", () => {
    assert.equal(avaliarPedidoMinimo(0, MINIMO).falta, MINIMO);
  });
});

describe("avisoDePedidoMinimo", () => {
  it("escreve o mínimo e o que falta, em reais", () => {
    assert.equal(
      plano(avisoDePedidoMinimo(avaliarPedidoMinimo(MINIMO - 2550, MINIMO))),
      "Pedido mínimo de R$ 120,00 em produtos. Faltam R$ 25,50.",
    );
  });

  it("não avisa quando atingiu nem quando a loja não tem mínimo", () => {
    assert.equal(avisoDePedidoMinimo(avaliarPedidoMinimo(MINIMO, MINIMO)), null);
    assert.equal(avisoDePedidoMinimo(avaliarPedidoMinimo(10, null)), null);
  });
});
