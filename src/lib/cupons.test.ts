import assert from "node:assert/strict";
import test from "node:test";
import type { Cupom } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { descontoDoCupom, normalizarCodigo } from "./cupons";

/**
 * Cupom é onde errar custa dinheiro do lojista na hora: um desconto calculado
 * a mais sai do bolso dele, e um a menos derruba a venda. Tudo aqui é cálculo
 * puro em centavos inteiros, sem banco.
 */

function cupom(parcial: Partial<Cupom>): Cupom {
  return {
    id: "c1",
    tenantId: "t1",
    codigo: "TESTE",
    tipo: "PERCENTUAL",
    valor: 10,
    minimoCentavos: 0,
    usos: 0,
    usosMax: null,
    validoAte: null,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...parcial,
  } as Cupom;
}

function itens(...precos: Array<[preco: number, quantidade: number]>): ItemCarrinho[] {
  return precos.map(([precoUnitario, quantidade], i) => ({
    id: `p${i}`,
    nome: `Produto ${i}`,
    precoUnitario,
    quantidade,
  })) as ItemCarrinho[];
}

test("código chega bagunçado e é normalizado", () => {
  assert.equal(normalizarCodigo(" bem vindo 10 "), "BEMVINDO10");
  assert.equal(normalizarCodigo("Frete\tGrátis"), "FRETEGRÁTIS");
});

test("percentual desconta sobre o subtotal, em centavos inteiros", () => {
  // R$ 59,90 x 2 = R$ 119,80; 10% = R$ 11,98
  assert.equal(descontoDoCupom(cupom({ valor: 10 }), itens([5990, 2])), 1198);
});

test("percentual arredonda para o centavo mais próximo", () => {
  // R$ 33,33 com 15% = R$ 4,9995 -> R$ 5,00
  assert.equal(descontoDoCupom(cupom({ valor: 15 }), itens([3333, 1])), 500);
});

test("percentual acima de 100 não paga o cliente para levar", () => {
  const desconto = descontoDoCupom(cupom({ valor: 150 }), itens([1000, 1]));
  assert.equal(desconto, 1000);
});

test("percentual negativo não vira acréscimo", () => {
  assert.equal(descontoDoCupom(cupom({ valor: -20 }), itens([1000, 1])), 0);
});

test("valor fixo maior que o carrinho para no subtotal", () => {
  // Sem o teto, um cupom de R$ 50 num carrinho de R$ 30 daria total negativo.
  assert.equal(descontoDoCupom(cupom({ tipo: "FIXO", valor: 5000 }), itens([3000, 1])), 3000);
});

test("valor fixo desconta o valor cheio quando cabe", () => {
  assert.equal(descontoDoCupom(cupom({ tipo: "FIXO", valor: 1500 }), itens([9990, 1])), 1500);
});

test("frete grátis não mexe no subtotal", () => {
  // Quem zera o frete é o frete.ts; aqui tem que sair zero, senão o desconto
  // seria contado duas vezes.
  assert.equal(descontoDoCupom(cupom({ tipo: "FRETE_GRATIS", valor: 0 }), itens([9990, 2])), 0);
});

test("carrinho vazio não gera desconto", () => {
  assert.equal(descontoDoCupom(cupom({ valor: 30 }), []), 0);
});

test("desconto considera a quantidade de cada item", () => {
  // R$ 10 x 3 + R$ 20 x 1 = R$ 50; 20% = R$ 10
  assert.equal(descontoDoCupom(cupom({ valor: 20 }), itens([1000, 3], [2000, 1])), 1000);
});
