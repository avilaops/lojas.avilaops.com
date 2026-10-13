import assert from "node:assert/strict";
import test from "node:test";
import { cepCertoConfigurada, chaveDaCepCerto, cotarCepCerto, extrairCotacoesCepCerto } from "./cepcerto";

/**
 * A leitura da resposta da CepCerto. Cada caso é um jeito de a loja cobrar do
 * comprador um frete que ela não consegue despachar por aquele preço.
 */

// O que o cotador da CepCerto mostrou para a conta em 13/10/2026.
const RESPOSTA = {
  status: "sucesso",
  cotacoes: [
    { transportadora: "Correios", servico: "PAC Mini", valor: "15,90", prazo: "até 8 dias" },
    { transportadora: "Jadlog", servico: "Jadlog Package", valor: "17,90", prazo: "até 7 dias" },
    { transportadora: "Jadlog", servico: "Jadlog .COM", valor: "18,70", prazo: "até 5 dias" },
    { transportadora: "Loggi", servico: "Loggi", valor: "17,50", prazo: "até 4 dias" },
    { transportadora: "Correios", servico: "PAC", valor: "21,40", prazo: "até 6 dias" },
    { transportadora: "Correios", servico: "PAC - Preço balcão Correios", valor: "32,80", prazo: "até 6 dias" },
    { transportadora: "Correios", servico: "SEDEX", valor: "29,80", prazo: "até 2 dias" },
    { transportadora: "Correios", servico: "SEDEX - Preço balcão Correios", valor: "46,90", prazo: "até 2 dias" },
  ],
};

test("fica o preço do contrato, sem balcão e sem Mini Envios, do mais barato ao mais caro", () => {
  assert.deepEqual(extrairCotacoesCepCerto(RESPOSTA), [
    { id: "cepcerto:loggi", nome: "Loggi", preco: 1750, prazoDiasUteis: 4 },
    { id: "cepcerto:jadlog-package", nome: "Jadlog Package", preco: 1790, prazoDiasUteis: 7 },
    { id: "cepcerto:jadlog-dotcom", nome: "Jadlog .com", preco: 1870, prazoDiasUteis: 5 },
    { id: "cepcerto:pac", nome: "PAC", preco: 2140, prazoDiasUteis: 6 },
    { id: "cepcerto:sedex", nome: "SEDEX", preco: 2980, prazoDiasUteis: 2 },
  ]);
});

test("resposta de erro, fora do formato ou sem preço não vira opção de frete", () => {
  assert.deepEqual(extrairCotacoesCepCerto({ status: "erro", mensagem: "Chave pública, domínio ou IP não autorizado." }), []);
  assert.deepEqual(extrairCotacoesCepCerto(null), []);
  assert.deepEqual(extrairCotacoesCepCerto({ status: "sucesso" }), []);
  assert.deepEqual(extrairCotacoesCepCerto({ status: "sucesso", cotacoes: [{ servico: "PAC", valor: "0,00" }, { servico: "PAC", valor: "" }, { servico: "Entrega expressa", valor: "9,90" }, null] }), []);
});

test("serviço repetido fica com o menor preço, e milhar com ponto é lido como milhar", () => {
  const opcoes = extrairCotacoesCepCerto({
    status: "sucesso",
    cotacoes: [
      { servico: "SEDEX", valor: "1.250,00", prazo: "2" },
      { servico: "SEDEX", valor: "980,50", prazo: "sem previsão" },
    ],
  });
  assert.deepEqual(opcoes, [{ id: "cepcerto:sedex", nome: "SEDEX", preco: 98050, prazoDiasUteis: 7 }]);
});

test("a chave pública só vale no formato da CepCerto", () => {
  assert.equal(chaveDaCepCerto({ CEPCERTO_PUBLIC_KEY: " pk_live_0123456789abcdef0123 " }), "pk_live_0123456789abcdef0123");
  assert.equal(cepCertoConfigurada({ CEPCERTO_PUBLIC_KEY: "pk_live_0123456789abcdef0123" }), true);
  for (const ruim of [undefined, "", "sk_live_0123456789abcdef0123", "pk_live_curta", "pk_live_0123456789abcdef0123\" onload=\"x"]) {
    assert.equal(cepCertoConfigurada({ CEPCERTO_PUBLIC_KEY: ruim }), false, String(ruim));
  }
});

test("a cotação manda a chave, os CEPs e o seguro dentro do piso e do teto", async () => {
  const antes = { fetch: globalThis.fetch, chave: process.env.CEPCERTO_PUBLIC_KEY };
  const chamadas: Array<{ url: string; headers: Record<string, string>; corpo: Record<string, string> }> = [];
  process.env.CEPCERTO_PUBLIC_KEY = "pk_live_0123456789abcdef0123";
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    chamadas.push({ url: String(url), headers: init?.headers as Record<string, string>, corpo: JSON.parse(String(init?.body)) });
    return Response.json(RESPOSTA);
  }) as typeof fetch;
  try {
    const pedido = { cepOrigem: "14075240", cepDestino: "01310100", pesoKg: 0.3, caixa: { altura: 2, largura: 11, comprimento: 16 }, valorDeclarado: 13.8 };
    const opcoes = await cotarCepCerto(pedido);
    assert.equal(opcoes?.length, 5);
    assert.equal(chamadas[0].url, "https://cepcerto.com/widget_frete/api/cotacao");
    assert.equal(chamadas[0].headers["x-cepcerto-public-key"], "pk_live_0123456789abcdef0123");
    assert.deepEqual(chamadas[0].corpo, {
      public_key: "pk_live_0123456789abcdef0123",
      cep_remetente: "14075240",
      cep_destinatario: "01310100",
      peso: "0.3",
      altura: "2",
      largura: "11",
      comprimento: "16",
      valor_encomenda: "50.00",
    });
    await cotarCepCerto({ ...pedido, valorDeclarado: 90_000 });
    assert.equal(chamadas[1].corpo.valor_encomenda, "35000.00");

    // Não autorizado, fora do ar e sem chave: `null`, para a loja cair na tabela dela.
    globalThis.fetch = (async () => Response.json({ status: "erro", mensagem: "Chave pública, domínio ou IP não autorizado." }, { status: 401 })) as typeof fetch;
    assert.equal(await cotarCepCerto(pedido), null);
    globalThis.fetch = (async () => { throw new Error("rede"); }) as typeof fetch;
    assert.equal(await cotarCepCerto(pedido), null);
    delete process.env.CEPCERTO_PUBLIC_KEY;
    globalThis.fetch = (async () => { throw new Error("não devia chamar"); }) as typeof fetch;
    assert.equal(await cotarCepCerto(pedido), null);
  } finally {
    globalThis.fetch = antes.fetch;
    if (antes.chave === undefined) delete process.env.CEPCERTO_PUBLIC_KEY;
    else process.env.CEPCERTO_PUBLIC_KEY = antes.chave;
  }
});
