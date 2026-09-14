import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcularTotais, formatarBRL, opcoesDeParcelamento } from "./totais.ts";
import type { ItemCarrinho, OpcaoFrete } from "./types.ts";

// Esta função decide quanto o cliente paga. É o motivo de ela ter teste antes
// de qualquer componente de tela: erro aqui não quebra nada visivelmente , só
// cobra o valor errado, e você descobre pela reclamação.

const item = (id: string, precoUnitario: number, quantidade = 1): ItemCarrinho => ({
  id,
  nome: id,
  quantidade,
  precoUnitario,
});

const frete = (preco: number): OpcaoFrete => ({
  id: "sedex",
  nome: "Sedex",
  preco,
  prazoDiasUteis: 3,
});

describe("calcularTotais", () => {
  it("soma preço × quantidade de cada item", () => {
    const t = calcularTotais({ itens: [item("a", 3140, 2), item("b", 1990)] });
    assert.equal(t.subtotal, 8270);
    assert.equal(t.quantidadeItens, 3);
  });

  it("soma o frete ao subtotal", () => {
    const t = calcularTotais({ itens: [item("a", 1000)], frete: frete(2350) });
    assert.equal(t.total, 3350);
  });

  it("trata carrinho vazio como zero, sem NaN", () => {
    const t = calcularTotais({ itens: [] });
    assert.equal(t.subtotal, 0);
    assert.equal(t.total, 0);
    assert.equal(t.quantidadeItens, 0);
  });

  it("aceita ausência de frete como zero, para o passo anterior à escolha", () => {
    const t = calcularTotais({ itens: [item("a", 5000)], frete: null });
    assert.equal(t.frete, 0);
    assert.equal(t.total, 5000);
  });

  it("nunca deixa o desconto tornar o total negativo", () => {
    // Cupom maior que o carrinho zera o pedido. Total negativo viraria crédito,
    // que nenhum gateway aceita cobrar , e o erro só apareceria na cobrança.
    const t = calcularTotais({ itens: [item("a", 1000)], desconto: 5000 });
    assert.equal(t.desconto, 1000);
    assert.equal(t.total, 0);
  });

  it("aplica o desconto sobre o subtotal, não sobre o frete", () => {
    const t = calcularTotais({ itens: [item("a", 10000)], frete: frete(2000), desconto: 10000 });
    assert.equal(t.total, 2000, "o frete continua devido mesmo com produto zerado");
  });

  it("mantém tudo em inteiro, sem resíduo de ponto flutuante", () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004. Em centavos inteiros, não.
    const t = calcularTotais({ itens: [item("a", 10), item("b", 20)] });
    assert.equal(t.subtotal, 30);
    assert.ok(Number.isInteger(t.total));
  });
});

describe("formatarBRL", () => {
  it("formata centavos como moeda brasileira", () => {
    //   é o espaço não separável que o Intl usa entre "R$" e o número.
    assert.equal(formatarBRL(3140).replace(/ /g, " "), "R$ 31,40");
    assert.equal(formatarBRL(0).replace(/ /g, " "), "R$ 0,00");
    assert.equal(formatarBRL(123456789).replace(/ /g, " "), "R$ 1.234.567,89");
  });
});

describe("opcoesDeParcelamento", () => {
  it("para de parcelar quando a parcela fica abaixo do mínimo", () => {
    // R$ 40,00 em 12x daria R$ 3,33 , parcela que o adquirente costuma recusar
    // e cujo custo de transação supera o próprio valor.
    const opcoes = opcoesDeParcelamento({ total: 4000 });
    assert.equal(opcoes.at(-1)?.parcelas, 8, "8x de R$ 5,00 é o último acima do mínimo");
  });

  it("sempre oferece ao menos a opção à vista", () => {
    const opcoes = opcoesDeParcelamento({ total: 100 });
    assert.equal(opcoes.length, 1);
    assert.equal(opcoes[0]?.parcelas, 1);
  });

  it("respeita o teto de parcelas", () => {
    const opcoes = opcoesDeParcelamento({ total: 1_000_000, maxParcelas: 6 });
    assert.equal(opcoes.length, 6);
  });
});
