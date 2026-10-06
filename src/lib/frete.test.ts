import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { cifrar } from "./cofre";
import { caixaDoCarrinho, cotarFrete, entregaLocal, pesoTotalKg } from "./frete";

/**
 * Frete errado sai do bolso do lojista em toda venda, e ninguém percebe até
 * fechar o mês. O que dá para testar sem rede é o que a gente manda para a
 * transportadora: caixa e peso.
 *
 * As duas funções são puras; a cotação em si depende do Melhor Envio, e o que
 * dá para travar dela está em melhor-envio.test.ts.
 */

function loja(parcial: Partial<Tenant> = {}): Tenant {
  return { pesoPadraoKg: 0.5, caixaPadrao: null, entregaLocal: [], ...parcial } as Tenant;
}

/** Motoboy de Ribeirão Preto: a faixa da VedaShow, que estreou o recurso. */
const MOTOBOY = [{ prefixos: ["14"], nome: "Motoboy Ribeirão", preco: 1500, prazoDiasUteis: 0, gratisAcima: 19900 }];

function item(parcial: Partial<ItemCarrinho> & { quantidade: number }): ItemCarrinho {
  return { id: "p", nome: "Produto", precoUnitario: 1000, ...parcial } as ItemCarrinho;
}

test("caixa empilha a altura e mantém a maior largura e o maior comprimento", () => {
  const caixa = caixaDoCarrinho(loja(), [
    item({ quantidade: 2, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 }),
    item({ quantidade: 1, alturaCm: 5, larguraCm: 40, comprimentoCm: 20 }),
  ]);
  assert.equal(caixa.altura, 25, "duas de 10 mais uma de 5");
  assert.equal(caixa.largura, 40, "a mais larga manda");
  assert.equal(caixa.comprimento, 30, "o mais comprido manda");
});

test("produto sem medida usa a caixa padrão da loja", () => {
  const caixa = caixaDoCarrinho(loja({ caixaPadrao: { altura: 8, largura: 25, comprimento: 35 } }), [item({ quantidade: 2 })]);
  assert.equal(caixa.altura, 16);
  assert.equal(caixa.largura, 25);
  assert.equal(caixa.comprimento, 35);
});

test("sem caixa padrão cai no padrão da plataforma", () => {
  const caixa = caixaDoCarrinho(loja(), [item({ quantidade: 1 })]);
  assert.deepEqual(caixa, { altura: 15, largura: 20, comprimento: 25 });
});

test("caixa nunca sai abaixo do mínimo dos Correios", () => {
  // Sem os pisos, um par de brincos seria recusado na cotação e o comprador
  // ficaria sem nenhuma opção de frete.
  const caixa = caixaDoCarrinho(loja(), [item({ quantidade: 1, alturaCm: 0.5, larguraCm: 3, comprimentoCm: 4 })]);
  assert.equal(caixa.altura, 2);
  assert.equal(caixa.largura, 11);
  assert.equal(caixa.comprimento, 16);
});

test("peso soma por quantidade e converte grama para quilo", () => {
  const peso = pesoTotalKg(loja(), [item({ quantidade: 3, pesoGramas: 800 }), item({ quantidade: 1, pesoGramas: 1200 })]);
  assert.equal(peso, 3.6, "2,4 kg mais 1,2 kg");
});

test("produto sem peso usa o peso padrão da loja", () => {
  const peso = pesoTotalKg(loja({ pesoPadraoKg: 2 }), [item({ quantidade: 2 })]);
  assert.equal(peso, 4);
});

test("peso nunca sai abaixo de 300 g", () => {
  // A transportadora recusa cotação de peso zero, e produto digital ou sem
  // cadastro de peso chegaria com zero aqui.
  assert.equal(pesoTotalKg(loja(), [item({ quantidade: 1, pesoGramas: 10 })]), 0.3);
  assert.equal(pesoTotalKg(loja(), []), 0.3);
});

/**
 * Entrega própria por faixa de CEP. Também é pura — o destino está ou não na
 * faixa pelo prefixo, sem consultar ninguém —, então dá para travar em teste
 * exatamente o que o comprador vai ver no checkout.
 */

test("faixa local aparece para o CEP de dentro e some para o de fora", () => {
  const t = loja({ entregaLocal: MOTOBOY });
  assert.deepEqual(entregaLocal(t, "14075-240", 5000), [
    { id: "local:0", nome: "Motoboy Ribeirão", preco: 1500, prazoDiasUteis: 0 },
  ]);
  assert.deepEqual(entregaLocal(t, "01310-100", 5000), [], "São Paulo capital não é Ribeirão");
});

test("faixa local zera sozinha acima do próprio piso", () => {
  const [opcao] = entregaLocal(loja({ entregaLocal: MOTOBOY }), "14075240", 19900);
  assert.equal(opcao.preco, 0);
  assert.equal(opcao.nome, "Motoboy Ribeirão · grátis");
});

test("prefixo vazio não vira entrega local para o Brasil inteiro", () => {
  // "".startsWith() casa com tudo: uma faixa salva pela metade prometeria
  // motoboy em Manaus. A faixa some em vez de valer para todo mundo.
  const t = loja({ entregaLocal: [{ prefixos: ["", "  "], nome: "Motoboy", preco: 1500, prazoDiasUteis: 0 }] });
  assert.deepEqual(entregaLocal(t, "69005-000", 5000), []);
});

test("prefixo aceita máscara e mais de uma faixa, ordenadas por preço", () => {
  const t = loja({
    entregaLocal: [
      { prefixos: ["14.0"], nome: "Expressa", preco: 2500, prazoDiasUteis: 0 },
      { prefixos: ["14"], nome: "Padrão", preco: 1200, prazoDiasUteis: 1 },
    ],
  });
  assert.deepEqual(entregaLocal(t, "14075240", 5000).map((o) => [o.id, o.nome, o.preco]), [
    ["local:1", "Padrão", 1200],
    ["local:0", "Expressa", 2500],
  ], "a mais barata primeiro, e o id continua colado no índice da faixa salva");
});

test("CEP incompleto e loja sem faixa não geram entrega local", () => {
  assert.deepEqual(entregaLocal(loja({ entregaLocal: MOTOBOY }), "1407", 5000), []);
  assert.deepEqual(entregaLocal(loja(), "14075240", 5000), []);
});

test("faixa com preço inválido some em vez de virar R$ NaN no checkout", () => {
  // A coluna é JSON; carga feita fora do painel pode gravar qualquer coisa.
  const t = loja({ entregaLocal: [
    { prefixos: ["14"], nome: "Quebrada", preco: "grátis" as unknown as number, prazoDiasUteis: 0 },
    { prefixos: ["14"], nome: "Boa", preco: 1500, prazoDiasUteis: 0 },
  ] });
  assert.deepEqual(entregaLocal(t, "14075240", 5000).map((o) => o.nome), ["Boa"]);
});

/**
 * O caminho até a transportadora, com a rede trocada por uma resposta fixa. O
 * que se trava aqui é o que sai da loja: o CEP de origem do jeito que o painel
 * gravou e o valor que a transportadora vai indenizar.
 */

// A conexão é da loja: token cifrado no tenant, válido por mais um mês, para a
// cotação não tentar renovar (o que iria ao banco).
process.env.LOJAS_SECRET ??= "0".repeat(64);
const CONECTADA = {
  melhorEnvioAccessTokenEnc: cifrar("token-de-teste"),
  melhorEnvioRefreshTokenEnc: cifrar("refresh-de-teste"),
  melhorEnvioExpiraEm: new Date(Date.now() + 30 * 86_400_000),
};

async function comMelhorEnvio<T>(resposta: unknown, corpo: (chamadas: Array<Record<string, unknown>>) => Promise<T>): Promise<T> {
  const fetchAntes = globalThis.fetch;
  const chamadas: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    chamadas.push(JSON.parse(String(init?.body ?? "{}")));
    return Response.json(resposta);
  }) as typeof fetch;
  try {
    return await corpo(chamadas);
  } finally {
    globalThis.fetch = fetchAntes;
  }
}

const PAC = [{ id: 1, name: "PAC", price: "21.40", delivery_time: 6, company: { name: "Correios" } }];

test("CEP de origem com máscara chega limpo à transportadora", async () => {
  // O painel grava "14010-100". Sem tirar o hífen o CEP tem nove caracteres, a
  // cotação é pulada e a loja cai na tabela por UF sem um erro em lugar nenhum.
  await comMelhorEnvio(PAC, async (chamadas) => {
    const opcoes = await cotarFrete(loja({ cepOrigem: "14010-100", ...CONECTADA }), "15075-170", [item({ quantidade: 2, precoUnitario: 4000 })]);
    assert.equal(chamadas.length, 1, "a cotação foi pedida");
    assert.deepEqual(chamadas[0].from, { postal_code: "14010100" });
    assert.deepEqual(chamadas[0].to, { postal_code: "15075170" });
    assert.equal((chamadas[0].options as { insurance_value: number }).insurance_value, 80, "centavos viram reais");
    assert.deepEqual(opcoes.filter((o) => o.id.startsWith("melhorenvio:")), [
      { id: "melhorenvio:1", nome: "PAC", preco: 2140, prazoDiasUteis: 6 },
    ]);
  });
});

test("loja sem CEP de origem não chama a transportadora", async () => {
  await comMelhorEnvio(PAC, async (chamadas) => {
    const opcoes = await cotarFrete(loja({ cepOrigem: null, ...CONECTADA }), "15075170", [item({ quantidade: 1 })]);
    assert.equal(chamadas.length, 0);
    assert.equal(opcoes.some((o) => o.id.startsWith("melhorenvio:")), false);
  });
});

test("loja que não conectou o Melhor Envio não chama a transportadora", async () => {
  // Sem conexão a loja segue na tabela própria: nada de cotar no contrato de
  // outra conta.
  await comMelhorEnvio(PAC, async (chamadas) => {
    const opcoes = await cotarFrete(loja({ cepOrigem: "14010100" }), "15075170", [item({ quantidade: 1 })]);
    assert.equal(chamadas.length, 0);
    assert.equal(opcoes.some((o) => o.id.startsWith("melhorenvio:")), false);
  });
});
