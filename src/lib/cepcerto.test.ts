import assert from "node:assert/strict";
import test from "node:test";
import { cepCertoConfigurada, chaveDaCepCerto, cotarCepCerto, extrairCotacoesCepCerto } from "./cepcerto";

// Contrato documentado de /ws/json-frete. Credenciais de teste, sem rede real.
const TOKEN = "consulta-de-teste/+=";
const RESPOSTA = {
  valorpac: "25,80",
  valorpac_desconto_cepcerto: "21,34",
  prazopac: "6",
  valorsedex: "27,60",
  valorsedex_desconto_cepcerto: "25,80",
  prazosedex: "2",
  valorminienvios_cepcerto: "14,90",
  prazominienvios_cepcerto: "7 dias",
};
const PEDIDO = {
  cepOrigem: "14075-240", cepDestino: "01310-100", pesoKg: 0.3,
  caixa: { altura: 2, largura: 11, comprimento: 16 }, valorDeclarado: 13.8,
};

test("consulta oferece somente PAC e SEDEX com desconto, ordenados por preço", () => {
  assert.deepEqual(extrairCotacoesCepCerto(RESPOSTA), [
    { id: "cepcerto:pac", nome: "PAC", preco: 2134, prazoDiasUteis: 6 },
    { id: "cepcerto:sedex", nome: "SEDEX", preco: 2580, prazoDiasUteis: 2 },
  ]);
  assert.equal(extrairCotacoesCepCerto({ ...RESPOSTA, valorpac_desconto_cepcerto: "30,00" })[0].id, "cepcerto:sedex");
});

test("consulta não substitui desconto ausente pelo preço de balcão nem pela resposta do widget", () => {
  assert.deepEqual(extrairCotacoesCepCerto({ valorpac: "25,80", prazopac: "6" }), []);
  assert.deepEqual(extrairCotacoesCepCerto({
    status: "sucesso", cotacoes: [{ servico: "PAC", valor: "21,34", prazo: "6" }],
  }), []);
});

test("consulta lê milhar brasileiro e valores numéricos sem inventar prazo", () => {
  assert.deepEqual(extrairCotacoesCepCerto({
    valorpac_desconto_cepcerto: "1.250,00", prazopac: "até 6 dias",
    valorsedex_desconto_cepcerto: 980.5, prazosedex: 2,
  }), [
    { id: "cepcerto:sedex", nome: "SEDEX", preco: 98050, prazoDiasUteis: 2 },
    { id: "cepcerto:pac", nome: "PAC", preco: 125000, prazoDiasUteis: 6 },
  ]);
});

test("consulta rejeita erro, formato inválido, preço e prazo não confirmados", () => {
  for (const invalida of [null, [], "erro", { ...RESPOSTA, status: "erro" }, { ...RESPOSTA, erro: "sem ciclo ativo" }]) {
    assert.deepEqual(extrairCotacoesCepCerto(invalida), []);
  }
  for (const valor of ["", "0,00", "-1,00", "21,34 inválido", "NaN", Infinity, Number.MAX_VALUE]) {
    assert.deepEqual(extrairCotacoesCepCerto({ valorpac_desconto_cepcerto: valor, prazopac: "6" }), []);
  }
  for (const prazo of [undefined, "", "sem previsão", "-2", "2 ou 6", 0, Infinity]) {
    assert.deepEqual(extrairCotacoesCepCerto({ valorpac_desconto_cepcerto: "21,34", prazopac: prazo }), []);
  }
});

test("somente o token de consulta habilita a CepCerto; pública e postagem são ignoradas", () => {
  assert.equal(chaveDaCepCerto({ CEPCERTO_CONSULTA_KEY: " " + TOKEN + " " }), TOKEN);
  assert.equal(cepCertoConfigurada({ CEPCERTO_CONSULTA_KEY: TOKEN }), true);
  for (const invalida of [undefined, "", " ", "token com espaço", "token\ncom-quebra"]) {
    assert.equal(cepCertoConfigurada({
      CEPCERTO_CONSULTA_KEY: invalida,
      CEPCERTO_PUBLIC_KEY: "pk_live_0123456789abcdef0123",
      CEPCERTO_POSTAGEM_KEY: "postagem-de-teste",
    }), false);
  }
});

test("consulta usa GET com token codificado, CEPs limpos e peso em gramas", async () => {
  const antes = { fetch: globalThis.fetch, token: process.env.CEPCERTO_CONSULTA_KEY };
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];
  process.env.CEPCERTO_CONSULTA_KEY = TOKEN;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    return Response.json(RESPOSTA);
  }) as typeof fetch;
  try {
    assert.equal((await cotarCepCerto(PEDIDO))?.length, 2);
    assert.equal(chamadas[0].url, "https://cepcerto.com/ws/json-frete/14075240/01310100/300/2/11/16/" + encodeURIComponent(TOKEN));
    assert.equal(chamadas[0].init?.method, "GET");
    assert.equal(chamadas[0].init?.body, undefined);
    assert.deepEqual(chamadas[0].init?.headers, { accept: "application/json" });
    assert.equal(chamadas[0].init?.cache, "no-store");
    assert.equal(chamadas[0].init?.redirect, "error");
    assert.ok(chamadas[0].init?.signal instanceof AbortSignal);
    await cotarCepCerto({ ...PEDIDO, pesoKg: 1.234 });
    assert.ok(chamadas[1].url.includes("/1234/2/11/16/"));

    delete process.env.CEPCERTO_CONSULTA_KEY;
    assert.equal(await cotarCepCerto(PEDIDO), null);
    assert.equal(chamadas.length, 2, "não usa outras credenciais na ausência do token de consulta");
  } finally {
    globalThis.fetch = antes.fetch;
    if (antes.token === undefined) delete process.env.CEPCERTO_CONSULTA_KEY;
    else process.env.CEPCERTO_CONSULTA_KEY = antes.token;
  }
});

test("consulta não consome a API com CEP, peso ou caixa inválidos", async () => {
  const antes = { fetch: globalThis.fetch, token: process.env.CEPCERTO_CONSULTA_KEY };
  let chamadas = 0;
  process.env.CEPCERTO_CONSULTA_KEY = TOKEN;
  globalThis.fetch = (async () => { chamadas++; return Response.json(RESPOSTA); }) as typeof fetch;
  try {
    for (const alteracao of [
      { cepOrigem: "" }, { cepDestino: "123" },
      { pesoKg: 0 }, { pesoKg: -1 }, { pesoKg: NaN }, { pesoKg: Infinity }, { pesoKg: 30.01 },
      { caixa: { altura: 0, largura: 11, comprimento: 16 } },
      { caixa: { altura: 2, largura: 101, comprimento: 16 } },
      { caixa: { altura: 90, largura: 90, comprimento: 30 } },
      { caixa: { altura: NaN, largura: 11, comprimento: 16 } },
    ]) {
      assert.equal(await cotarCepCerto({ ...PEDIDO, ...alteracao }), null);
    }
    assert.equal(chamadas, 0);
    assert.equal((await cotarCepCerto({ ...PEDIDO, pesoKg: 30, caixa: { altura: 100, largura: 50, comprimento: 50 } }))?.length, 2);
  } finally {
    globalThis.fetch = antes.fetch;
    if (antes.token === undefined) delete process.env.CEPCERTO_CONSULTA_KEY;
    else process.env.CEPCERTO_CONSULTA_KEY = antes.token;
  }
});

test("consulta falha sem expor o token em erro HTTP, JSON ou rede", async () => {
  const antes = { fetch: globalThis.fetch, token: process.env.CEPCERTO_CONSULTA_KEY, error: console.error };
  const logs: string[] = [];
  process.env.CEPCERTO_CONSULTA_KEY = TOKEN;
  console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  try {
    for (const resposta of [
      () => Response.json({ mensagem: TOKEN }, { status: 422 }),
      () => Response.json({ ...RESPOSTA, status: "erro", mensagem: TOKEN }),
      () => Response.json({ mensagem: TOKEN }),
      () => new Response("JSON inválido"),
      () => { throw new Error("fetch " + TOKEN + " " + encodeURIComponent(TOKEN)); },
    ]) {
      globalThis.fetch = (async () => resposta()) as typeof fetch;
      assert.equal(await cotarCepCerto(PEDIDO), null);
    }
    assert.ok(logs.length > 0);
    assert.ok(!logs.join("\n").includes(TOKEN));
    assert.ok(!logs.join("\n").includes(encodeURIComponent(TOKEN)));
  } finally {
    globalThis.fetch = antes.fetch;
    console.error = antes.error;
    if (antes.token === undefined) delete process.env.CEPCERTO_CONSULTA_KEY;
    else process.env.CEPCERTO_CONSULTA_KEY = antes.token;
  }
});
