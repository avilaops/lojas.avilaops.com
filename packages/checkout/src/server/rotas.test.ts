import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { criarRotaPagamento, criarRotaStatus, criarRotaWebhook } from "./rotas.ts";
import type { PayloadCheckout, ResolucaoCatalogo } from "./pedido.ts";
import type { PaymentProvider } from "../providers/types.ts";
import type { ResultadoPagamento } from "../core/types.ts";

// O que cada rota responde quando o gateway demora além do tempo-limite. O
// provedor rejeita com `TimeoutError` (`AbortSignal.timeout`); a rota não pode
// devolver 500 cru nem prometer o que não sabe.

const catalogo: ResolucaoCatalogo = {
  resolverItens: async (ids) => ids.map((i) => ({ id: i.id, nome: "V-Floc 500ml", quantidade: i.quantidade, precoUnitario: 3140 })),
  resolverFretes: async () => [{ id: "sedex", nome: "Sedex", preco: 2500, prazoDiasUteis: 3 }],
};

const PAYLOAD: PayloadCheckout = {
  referencia: "PED-1",
  itens: [{ id: "v-floc", quantidade: 1 }],
  cliente: { nome: "Nicolas", sobrenome: "Avila", email: "cliente@example.com", telefone: "(16) 99412-3923", documento: "529.982.247-25" },
  entrega: { cep: "14075-240", logradouro: "R. Holanda", numero: "1200", bairro: "Vila Mariana", cidade: "Ribeirão Preto", uf: "SP" },
  freteId: "sedex",
  meioPagamento: "pix",
};

const PAGO: ResultadoPagamento = { id: "123", status: "aprovado", meioPagamento: "pix", valor: 5640 };

const estouro = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");

function provedor(mudancas: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    nome: "dublê",
    cobrar: async () => PAGO,
    consultar: async () => PAGO,
    estornar: async () => PAGO,
    validarWebhook: async () => ({ pagamentoId: "123" }),
    ...mudancas,
  };
}

const pedir = (corpo: unknown) => new Request("https://loja.test/api/checkout", { method: "POST", body: JSON.stringify(corpo) });
const lido = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe("rotas de checkout diante de tempo-limite do gateway", () => {
  it("cobrar que estoura o tempo devolve 503 a confirmar, sem prometer que nada foi cobrado", async (t) => {
    t.mock.method(console, "error", () => {});
    const aoCriarPagamento = mock.fn(async () => {});
    const rota = criarRotaPagamento({ provider: provedor({ cobrar: () => Promise.reject(estouro()) }), catalogo, aoCriarPagamento });

    const r = await rota(pedir(PAYLOAD));

    assert.equal(r.status, 503);
    const corpo = await lido(r);
    assert.equal(corpo.codigo, "pagamento_a_confirmar");
    assert.equal(corpo.referencia, "PED-1");
    assert.doesNotMatch(String(corpo.erro), /nada foi cobrado/i);
    assert.equal(aoCriarPagamento.mock.callCount(), 0);
  });

  it("falha ao gravar depois de cobrar também é a confirmar: a cobrança existe", async (t) => {
    t.mock.method(console, "error", () => {});
    const rota = criarRotaPagamento({ provider: provedor(), catalogo, aoCriarPagamento: () => Promise.reject(new Error("banco fora")) });

    const r = await rota(pedir(PAYLOAD));

    assert.equal(r.status, 503);
    assert.equal((await lido(r)).codigo, "pagamento_a_confirmar");
  });

  it("recusa do gateway segue 502 falha_gateway, sem a mensagem crua", async (t) => {
    t.mock.method(console, "error", () => {});
    const rota = criarRotaPagamento({ provider: provedor({ cobrar: () => Promise.reject(new Error("MP 400: segredo interno")) }), catalogo });

    const r = await rota(pedir(PAYLOAD));

    assert.equal(r.status, 502);
    const corpo = await lido(r);
    assert.equal(corpo.codigo, "falha_gateway");
    assert.doesNotMatch(JSON.stringify(corpo), /segredo interno/);
  });

  it("pedido inválido segue 422 e não chega ao gateway", async () => {
    const cobrar = mock.fn(async () => PAGO);
    const rota = criarRotaPagamento({ provider: provedor({ cobrar }), catalogo });

    const r = await rota(pedir({ ...PAYLOAD, itens: [] }));

    assert.equal(r.status, 422);
    assert.equal(cobrar.mock.callCount(), 0);
  });

  it("status: consultar que estoura o tempo devolve 502 com mensagem nossa", async (t) => {
    t.mock.method(console, "error", () => {});
    const rota = criarRotaStatus({ provider: provedor({ consultar: () => Promise.reject(estouro()) }) });

    const r = await rota(new Request("https://loja.test/api/checkout/status?id=123"));

    assert.equal(r.status, 502);
    assert.deepEqual(await lido(r), { erro: "Não foi possível consultar o pagamento." });
  });

  it("webhook: consultar que estoura o tempo responde 200 e não atualiza status", async (t) => {
    t.mock.method(console, "error", () => {});
    const aoAtualizarStatus = mock.fn(async () => {});
    const rota = criarRotaWebhook({ provider: provedor({ consultar: () => Promise.reject(estouro()) }), catalogo, aoAtualizarStatus });

    const r = await rota(new Request("https://loja.test/api/webhooks/mp?id=123", { method: "POST", body: "{}" }));

    assert.equal(r.status, 200);
    assert.deepEqual(await lido(r), { recebido: true });
    assert.equal(aoAtualizarStatus.mock.callCount(), 0);
  });
});
