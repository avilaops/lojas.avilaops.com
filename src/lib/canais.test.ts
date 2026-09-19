import assert from "node:assert/strict";
import test from "node:test";
import {
  REGRAS_PADRAO,
  acrescimoQueCobreComissao,
  estoqueDoCanal,
  gravarRegrasDoCanal,
  impedimentoNoCanal,
  lerRegrasDoCanal,
  precoDoCanal,
  resolverRegrasDoCanal,
} from "./canais";

test("loja que nunca abriu a tela publica como sempre publicou", () => {
  const r = lerRegrasDoCanal({}, "mercadolivre");
  assert.deepEqual(r, REGRAS_PADRAO);
  assert.equal(precoDoCanal(12345, r), 12345);
  assert.equal(estoqueDoCanal(7, r), 7);
});

test("o acréscimo incide sobre o preço e o arredondamento nunca desce", () => {
  const r = { ...REGRAS_PADRAO, acrescimoPercentual: 16.3 };
  assert.equal(precoDoCanal(10000, r), 11630);

  // Para cima, sempre: arredondar para baixo venderia abaixo do que o lojista
  // mandou vender, e a diferença sairia da margem dele sem ninguém decidir.
  assert.equal(precoDoCanal(12345, { ...r, acrescimoPercentual: 0, arredondamento: "noventa" }), 12390);
  assert.equal(precoDoCanal(12390, { ...r, acrescimoPercentual: 0, arredondamento: "noventa" }), 12390);
  assert.equal(precoDoCanal(12301, { ...r, acrescimoPercentual: 0, arredondamento: "inteiro" }), 12400);
  assert.equal(precoDoCanal(12400, { ...r, acrescimoPercentual: 0, arredondamento: "inteiro" }), 12400);
});

test("produto de graça continua de graça, e não vira o piso do arredondamento", () => {
  assert.equal(precoDoCanal(0, { ...REGRAS_PADRAO, arredondamento: "noventa" }), 0);
});

test("o acréscimo sugerido cobre a comissão, que incide sobre o preço já acrescido", () => {
  // 14% não devolve 14%: R$ 100 + 14% = 114, menos 14% de 114 = 98,04.
  assert.equal(acrescimoQueCobreComissao(14), 16.3);
  assert.equal(acrescimoQueCobreComissao(0), 0);

  const r = { ...REGRAS_PADRAO, acrescimoPercentual: acrescimoQueCobreComissao(14) };
  const liquido = precoDoCanal(10000, r) * 0.86;
  assert.ok(Math.abs(liquido - 10000) < 50, `líquido ${liquido} deveria voltar aos 10000`);
});

test("o estoque reservado é o colchão contra vender a mesma peça duas vezes", () => {
  const r = { ...REGRAS_PADRAO, estoqueReservado: 1 };
  assert.equal(estoqueDoCanal(3, r), 2);
  assert.equal(estoqueDoCanal(1, r), 0);
  assert.equal(estoqueDoCanal(null, r), 0);
  assert.equal(estoqueDoCanal(50, { ...r, estoqueMaximo: 5 }), 5);
});

test("regras fora da faixa são limitadas, não recusadas", () => {
  // O JSON pode ter vindo de uma versão anterior; derrubar a publicação de um
  // catálogo inteiro por causa de um número velho seria pior que limitá-lo.
  const r = lerRegrasDoCanal(
    { mercadolivre: { acrescimoPercentual: -5, estoqueReservado: -2, garantiaMeses: 999, arredondamento: "chute" } },
    "mercadolivre",
  );
  assert.equal(r.acrescimoPercentual, 0);
  assert.equal(r.estoqueReservado, 0);
  assert.equal(r.garantiaMeses, 120);
  assert.equal(r.arredondamento, "nenhum");
});

test("gravar um canal não apaga o outro", () => {
  const antes = { shopee: { acrescimoPercentual: 25 } };
  const depois = gravarRegrasDoCanal(antes, "mercadolivre", { ...REGRAS_PADRAO, acrescimoPercentual: 16.3 });
  assert.equal(depois.shopee?.acrescimoPercentual, 25);
  assert.equal(depois.mercadolivre?.acrescimoPercentual, 16.3);
});

test("o impedimento diz o que falta, e diferencia sem estoque de estoque reservado", () => {
  const base = { ativo: true, precoCentavos: 5000, estoque: 1 };
  assert.equal(impedimentoNoCanal(base, REGRAS_PADRAO), null);
  assert.match(
    impedimentoNoCanal(base, { ...REGRAS_PADRAO, estoqueReservado: 1 }) ?? "",
    /reservado para a loja/,
  );
  assert.match(
    impedimentoNoCanal(base, { ...REGRAS_PADRAO, precoMinimoCentavos: 9900 }) ?? "",
    /abaixo do mínimo/,
  );
  assert.match(impedimentoNoCanal({ ...base, ativo: false }, REGRAS_PADRAO) ?? "", /inativo na loja/);
  assert.match(impedimentoNoCanal(base, { ...REGRAS_PADRAO, ativo: false }) ?? "", /desligada nas regras/);
});

test("o resolvedor devolve as regras da loja para todo produto, hoje", () => {
  // O acréscimo por categoria não existe, e não deve existir antes de um
  // lojista precisar. O que o resolvedor garante é a forma: quem publica já
  // pergunta produto a produto, então o dia em que existir muda só aqui.
  const globais = { ...REGRAS_PADRAO, acrescimoPercentual: 16.3 };
  const paraProduto = resolverRegrasDoCanal(globais);
  assert.deepEqual(paraProduto({ categoriaMl: "MLB455028" }), globais);
  assert.deepEqual(paraProduto({ categoriaMl: null }), globais);
  assert.deepEqual(paraProduto({}), globais);
});
