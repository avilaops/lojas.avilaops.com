import assert from "node:assert/strict";
import test from "node:test";
import { ambienteDoMelhorEnvio, baseDoMelhorEnvio, cotarMelhorEnvio, extrairCotacoes, lojaPermitidaNoMelhorEnvio, type PedidoDeCotacao } from "./melhor-envio";

delete process.env.MELHOR_ENVIO_URL;

/**
 * A chamada ao Melhor Envio é integração e fica de fora; o que dá para travar
 * sem rede é a leitura da resposta, que é onde o preço do checkout nasce.
 *
 * O formato abaixo é o de `POST /api/v2/me/shipment/calculate`: uma lista com
 * um item por serviço, preço em texto com ponto, e erro no próprio item.
 */

const RESPOSTA = [
  { id: 2, name: "SEDEX", price: "32.10", custom_price: "32.10", delivery_time: 2, custom_delivery_time: 2, company: { id: 1, name: "Correios" } },
  { id: 1, name: "PAC", price: "21.40", custom_price: "23.72", delivery_time: 6, custom_delivery_time: 8, company: { id: 1, name: "Correios" } },
  { id: 3, name: ".Package", price: "18.95", custom_price: "18.95", delivery_time: 5, custom_delivery_time: 5, company: { id: 2, name: "Jadlog" } },
  { id: 4, name: ".Com", error: "Transportadora não atende este trecho.", company: { id: 2, name: "Jadlog" } },
];

test("lê preço em centavos, ordena pelo mais barato e identifica o serviço", () => {
  assert.deepEqual(extrairCotacoes(RESPOSTA), [
    { id: "melhorenvio:3", nome: "Jadlog .Package", preco: 1895, prazoDiasUteis: 5 },
    { id: "melhorenvio:1", nome: "PAC", preco: 2372, prazoDiasUteis: 8 },
    { id: "melhorenvio:2", nome: "SEDEX", preco: 3210, prazoDiasUteis: 2 },
  ]);
});

test("serviço que não atende o trecho não vira opção de R$ 0", () => {
  // O item com `error` não traz preço: sem o filtro ele entraria como frete
  // grátis e seria justamente o primeiro da lista.
  assert.equal(extrairCotacoes(RESPOSTA).some((o) => o.id === "melhorenvio:4"), false);
});

test("o preço configurado na conta vence o preço cru do serviço", () => {
  const [pac] = extrairCotacoes([RESPOSTA[1]]);
  assert.equal(pac.preco, 2372, "custom_price, não price");
  assert.equal(pac.prazoDiasUteis, 8, "custom_delivery_time, não delivery_time");
});

test("nome do serviço não repete a transportadora que já está nele", () => {
  const [loggi] = extrairCotacoes([{ id: 31, name: "Loggi Express", price: "15.00", delivery_time: 3, company: { name: "Loggi" } }]);
  assert.equal(loggi.nome, "Loggi Express");
});

test("item sem prazo ou sem preço válido não vira promessa de entrega", () => {
  assert.deepEqual(extrairCotacoes([
    { id: 1, name: "PAC", price: "20.00", company: { name: "Correios" } },
    { id: 2, name: "SEDEX", price: "0.00", delivery_time: 2, company: { name: "Correios" } },
    { id: 17, name: "Mini Envios", delivery_time: 7, company: { name: "Correios" } },
  ]), []);
});

test("prazo pode vir da faixa customizada e aceita entrega no mesmo dia", () => {
  assert.deepEqual(extrairCotacoes([
    { id: 1, name: "PAC", price: "20.00", delivery_time: 3, custom_delivery_range: { min: 4, max: 6 } },
    { id: 2, name: "Express", price: "12.00", custom_delivery_time: 0 },
    { id: 3, name: "Normal", price: "22.00", delivery_range: { min: 5, max: 8 } },
  ]).map((o) => [o.id, o.prazoDiasUteis]), [["melhorenvio:2", 0], ["melhorenvio:1", 6], ["melhorenvio:3", 8]]);
});

test("valores corrompidos do provedor são recusados sem usar preço cru no lugar", () => {
  const valido = { id: 1, name: "PAC", price: "20.00", delivery_time: 3 };
  const invalidos = [
    { custom_price: "12,99" }, { custom_price: "12.99 indevido" }, { custom_price: "" },
    { custom_price: -1 }, { price: Infinity }, { price: 0.001 }, { price: Number.MAX_VALUE },
    { id: "1errado" }, { id: 0 }, { id: 1.5 }, { name: {} },
    { custom_delivery_time: -1 }, { custom_delivery_time: 2.5 }, { custom_delivery_time: "" },
  ];
  assert.deepEqual(extrairCotacoes([null, "inválido", [], ...invalidos.map((d) => ({ ...valido, ...d }))]), []);
});

const PEDIDO: PedidoDeCotacao = {
  cepOrigem: "14010-100", cepDestino: "15075-170", pesoKg: 0.5,
  caixa: { altura: 15, largura: 20, comprimento: 25 }, valorDeclarado: 138.9,
};

test("envia volumes e seguro em reais conforme o contrato publicado", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer token-teste");
    assert.match((init.headers as Record<string, string>)["user-agent"], /Lojas Avila Ops/);
    const corpo = JSON.parse(String(init.body));
    assert.deepEqual(corpo.from, { postal_code: "14010100" });
    assert.deepEqual(corpo.to, { postal_code: "15075170" });
    assert.deepEqual(corpo.volumes, [{ height: 15, width: 20, length: 25, weight: 0.5, insurance: 138.9 }]);
    assert.deepEqual(corpo.options, { receipt: false, own_hand: false });
    assert.equal(corpo.package, undefined);
    return Response.json(RESPOSTA);
  });
  assert.equal((await cotarMelhorEnvio("token-teste", PEDIDO))?.length, 3);
});

test("pacote inválido não dispara requisição para o provedor", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(RESPOSTA));
  for (const p of [{ ...PEDIDO, pesoKg: 0 }, { ...PEDIDO, valorDeclarado: NaN },
    { ...PEDIDO, cepDestino: "123" }, { ...PEDIDO, caixa: { ...PEDIDO.caixa, altura: -2 } }]) {
    assert.equal(await cotarMelhorEnvio("token-teste", p), null);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("base só admite produção e sandbox oficiais antes de enviar credenciais", (t) => {
  const anterior = process.env.MELHOR_ENVIO_URL;
  t.after(() => {
    if (anterior === undefined) delete process.env.MELHOR_ENVIO_URL;
    else process.env.MELHOR_ENVIO_URL = anterior;
  });
  process.env.MELHOR_ENVIO_URL = "https://sandbox.melhorenvio.com.br/";
  assert.equal(baseDoMelhorEnvio(), "https://sandbox.melhorenvio.com.br");
  assert.equal(ambienteDoMelhorEnvio(), "sandbox");
  delete process.env.MELHOR_ENVIO_URL;
  assert.equal(ambienteDoMelhorEnvio(), "sandbox", "ausência de configuração nunca aciona produção");
  process.env.MELHOR_ENVIO_URL = "https://melhorenvio.com.br";
  assert.equal(ambienteDoMelhorEnvio(), "producao", "produção exige configuração explícita");
  process.env.MELHOR_ENVIO_URL = "https://outro-dominio.invalid";
  assert.throws(() => baseDoMelhorEnvio(), /oficiais/);
});

test("erro HTTP e exceção não incluem resposta ou token nos logs", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "segredo-na-resposta" }, { status: 401 }));
  assert.equal(await cotarMelhorEnvio("token-teste", PEDIDO), null);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("segredo-na-excecao"); });
  assert.equal(await cotarMelhorEnvio("token-teste", PEDIDO), null);
  assert.doesNotMatch(JSON.stringify(logs), /segredo|token-teste/);
});

test("sandbox nasce bloqueado e respeita o desligamento global do recurso", (t) => {
  assert.equal(lojaPermitidaNoMelhorEnvio({ recursos: [] }), false);
  const loja = { recursos: ["frete_melhor_envio_sandbox"] };
  assert.equal(lojaPermitidaNoMelhorEnvio(loja), true);
  const anterior = process.env.LOJAS_RECURSOS_DESLIGADOS;
  t.after(() => {
    if (anterior === undefined) delete process.env.LOJAS_RECURSOS_DESLIGADOS;
    else process.env.LOJAS_RECURSOS_DESLIGADOS = anterior;
  });
  process.env.LOJAS_RECURSOS_DESLIGADOS = "frete_melhor_envio_sandbox";
  assert.equal(lojaPermitidaNoMelhorEnvio(loja), false);
});

test("resposta que não é lista não derruba a cotação", () => {
  // Token inválido devolve um objeto `{ message: "Unauthenticated." }`.
  assert.deepEqual(extrairCotacoes({ message: "Unauthenticated." }), []);
  assert.deepEqual(extrairCotacoes(null), []);
});

test("sem token não cota e não chama a rede", async () => {
  const fetchAntes = globalThis.fetch;
  let chamou = false;
  globalThis.fetch = (async () => { chamou = true; return Response.json([]); }) as typeof fetch;
  try {
    assert.equal(
      await cotarMelhorEnvio("", { cepOrigem: "14010100", cepDestino: "15075170", pesoKg: 0.5, caixa: { altura: 15, largura: 20, comprimento: 25 }, valorDeclarado: 80 }),
      null,
    );
    assert.equal(chamou, false);
  } finally {
    globalThis.fetch = fetchAntes;
  }
});
