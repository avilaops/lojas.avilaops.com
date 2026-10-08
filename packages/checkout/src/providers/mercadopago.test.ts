import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MercadoPagoProvider } from "./mercadopago.ts";
import type { PedidoCheckout } from "../core/types.ts";

// Nenhum destes testes chama o Mercado Pago: o `fetch` global é um dublê,
// trocado antes de cada caso e restaurado depois.

interface Chamada {
  url: string;
  init: RequestInit;
}

const fetchOriginal = globalThis.fetch;
let chamadas: Chamada[] = [];

/** Troca o `fetch` por um que anota a chamada e responde com o que for dado. */
function dublar(responder: (chamada: Chamada) => Response | Promise<Response>) {
  globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const chamada = { url: String(entrada), init: init ?? {} };
    chamadas.push(chamada);
    return responder(chamada);
  }) as typeof fetch;
}

function json(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
}

function cabecalho(chamada: Chamada, nome: string) {
  return new Headers(chamada.init.headers).get(nome);
}

const PAGAMENTO = { id: 123, status: "approved", payment_method_id: "pix", transaction_amount: 31.4 };

const PEDIDO: PedidoCheckout = {
  referencia: "PED-1",
  itens: [{ id: "v-floc", nome: "V-Floc 500ml", quantidade: 1, precoUnitario: 3140 }],
  cliente: {
    nome: "Nicolas",
    sobrenome: "Avila",
    email: "cliente@example.com",
    telefone: "11999999999",
    documento: "52998224725",
  },
  frete: { id: "sedex", nome: "Sedex", preco: 0, prazoDiasUteis: 3 },
  meioPagamento: "pix",
};

function provedor() {
  return new MercadoPagoProvider({ accessToken: "token-de-teste" });
}

function estouro() {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

describe("MercadoPagoProvider: tempo-limite e idempotência", () => {
  beforeEach(() => {
    chamadas = [];
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("cobrar entrega um AbortSignal ao fetch e mantém a chave de idempotência", async () => {
    dublar(() => json(PAGAMENTO));

    const resultado = await provedor().cobrar(PEDIDO, 3140);

    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, "https://api.mercadopago.com/v1/payments");
    assert.ok(chamadas[0].init.signal instanceof AbortSignal);
    assert.equal(chamadas[0].init.signal.aborted, false);
    assert.equal(cabecalho(chamadas[0], "x-idempotency-key"), PEDIDO.referencia);
    assert.equal(resultado.status, "aprovado");
    assert.equal(resultado.valor, 3140);
  });

  it("consultar entrega um AbortSignal ao fetch", async () => {
    dublar(() => json(PAGAMENTO));

    await provedor().consultar("123");

    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, "https://api.mercadopago.com/v1/payments/123");
    assert.ok(chamadas[0].init.signal instanceof AbortSignal);
  });

  it("estornar entrega um AbortSignal ao fetch e mantém a chave de idempotência (parcial)", async () => {
    dublar((chamada) => json(chamada.url.endsWith("/refunds") ? { id: 9 } : { ...PAGAMENTO, status: "refunded" }));

    const resultado = await provedor().estornar("123", { valorEmCentavos: 1000 });

    // O estorno e, em seguida, a consulta do estado final do pagamento.
    assert.equal(chamadas.length, 2);
    assert.equal(chamadas[0].url, "https://api.mercadopago.com/v1/payments/123/refunds");
    assert.ok(chamadas[0].init.signal instanceof AbortSignal);
    assert.equal(cabecalho(chamadas[0], "x-idempotency-key"), "refund:123:1000");
    assert.ok(chamadas[1].init.signal instanceof AbortSignal);
    assert.equal(resultado.status, "estornado");
  });

  it("estornar total usa a chave refund:<id>:total", async () => {
    dublar((chamada) => json(chamada.url.endsWith("/refunds") ? { id: 9 } : { ...PAGAMENTO, status: "refunded" }));

    await provedor().estornar("123");

    assert.equal(cabecalho(chamadas[0], "x-idempotency-key"), "refund:123:total");
  });

  it("cobrar rejeita quando o fetch estoura o tempo-limite", async () => {
    dublar(() => Promise.reject(estouro()));

    await assert.rejects(provedor().cobrar(PEDIDO, 3140), { name: "TimeoutError" });
  });

  it("consultar rejeita quando o fetch estoura o tempo-limite", async () => {
    dublar(() => Promise.reject(estouro()));

    await assert.rejects(provedor().consultar("123"), { name: "TimeoutError" });
  });

  it("estornar rejeita quando o fetch estoura o tempo-limite", async () => {
    dublar(() => Promise.reject(estouro()));

    await assert.rejects(provedor().estornar("123"), { name: "TimeoutError" });
  });
});
