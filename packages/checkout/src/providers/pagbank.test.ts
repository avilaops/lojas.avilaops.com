import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, it, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { CobrancaRecusada } from "./erros.ts";
import { definicaoPagBank } from "./pagbank-definicao.ts";
import { PagBankProvider, chaveDeIdempotencia, referenciaDaApi } from "./pagbank.ts";
import type { PedidoCheckout } from "../core/types.ts";

// Nenhum destes testes chama o PagBank: o `fetch` global é um dublê.

interface Chamada {
  url: string;
  init: RequestInit;
}

const fetchOriginal = globalThis.fetch;
let chamadas: Chamada[] = [];

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

function corpo(chamada: Chamada): Record<string, unknown> {
  return JSON.parse(String(chamada.init.body)) as Record<string, unknown>;
}

function espiarTempoLimite(t: TestContext): number[] {
  const original = AbortSignal.timeout.bind(AbortSignal);
  const pedidos: number[] = [];
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    pedidos.push(ms);
    return original(ms);
  });
  return pedidos;
}

const CIFRADO = "Q".repeat(160);
const ENTREGA = {
  cep: "01452002",
  logradouro: "Avenida Exemplo",
  numero: "100",
  bairro: "Centro",
  cidade: "Sao Paulo",
  uf: "SP",
};

function pedido(meio: PedidoCheckout["meioPagamento"], extra: Partial<PedidoCheckout> = {}): PedidoCheckout {
  return {
    referencia: "PED-1",
    itens: [{ id: "sku-1", nome: "Item exemplo", quantidade: 1, precoUnitario: 3140 }],
    cliente: {
      nome: "Cliente",
      sobrenome: "Exemplo",
      email: "cliente@example.com",
      telefone: "11999999999",
      documento: "52998224725",
    },
    entrega: ENTREGA,
    frete: { id: "sedex", nome: "Sedex", preco: 0, prazoDiasUteis: 3 },
    meioPagamento: meio,
    ...extra,
  };
}

function cobranca(mudancas: Record<string, unknown> = {}) {
  return {
    id: "CHAR_TESTE",
    reference_id: "PED-1",
    status: "PAID",
    created_at: "2026-10-13T12:00:00.000-03:00",
    amount: { value: 3140, currency: "BRL", summary: { total: 3140, paid: 3140, refunded: 0 } },
    payment_response: { code: "20000", message: "SUCESSO" },
    payment_method: { type: "PIX" },
    ...mudancas,
  };
}

function pedidoApi(charges: Record<string, unknown>[], reference = "PED-1") {
  return { id: "ORDE_TESTE", reference_id: reference, created_at: "2026-10-13T12:00:00.000-03:00", charges };
}

function provedor(mudancas: Partial<ConstructorParameters<typeof PagBankProvider>[0]> = {}) {
  return new PagBankProvider({ accessToken: "TEST-token", chavePublicaWebhook: CHAVE_PUBLICA, ...mudancas });
}

const par = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const CHAVE_PUBLICA = par.publicKey.export({ type: "spki", format: "der" }).toString("base64");

function assinar(corpoBruto: string): string {
  return sign("sha256", Buffer.from(corpoBruto, "utf8"), par.privateKey).toString("base64");
}

describe("PagBankProvider: cobrança", () => {
  beforeEach(() => {
    chamadas = [];
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("Pix vai em POST /orders, em centavos, com idempotência e sem dado de cartão", async (t) => {
    const tempos = espiarTempoLimite(t);
    dublar(() =>
      json(
        pedidoApi([
          cobranca({
            status: "WAITING",
            qr_code: { text: "000201010212BR.GOV.BCB.PIX" },
            payment_method: { type: "PIX", pix: { expiration_date: "2026-10-13T15:00:00.000Z" } },
          }),
        ]),
        201,
      ),
    );

    const resultado = await provedor({ notificationUrl: "https://lojas.example/api/webhooks/pagbank?loja=demo" }).cobrar(pedido("pix"), 3140);

    assert.deepEqual(tempos, [20_000]);
    assert.equal(chamadas[0].url, "https://api.pagseguro.com/orders");
    assert.equal(cabecalho(chamadas[0], "authorization"), "Bearer TEST-token");
    assert.equal(cabecalho(chamadas[0], "x-idempotency-key"), chaveDeIdempotencia("PED-1"));
    const enviado = corpo(chamadas[0]);
    assert.equal(enviado.reference_id, "PED-1");
    assert.deepEqual((enviado.notification_urls as string[])[0], "https://lojas.example/api/webhooks/pagbank?loja=demo");
    const charges = enviado.charges as { amount: { value: number }; payment_method: { type: string; card?: unknown } }[];
    assert.equal(charges[0].amount.value, 3140);
    assert.equal(charges[0].payment_method.type, "PIX");
    assert.equal(charges[0].payment_method.card, undefined);
    assert.equal(JSON.stringify(enviado).includes("411111"), false);
    assert.equal(resultado.id, "CHAR_TESTE");
    assert.equal(resultado.status, "pendente");
    assert.equal(resultado.meioPagamento, "pix");
    assert.equal(resultado.valor, 3140);
    assert.equal(resultado.pix?.copiaECola, "000201010212BR.GOV.BCB.PIX");
    assert.equal(resultado.pix?.qrCodeBase64, undefined);
  });

  it("cartão manda só o criptograma e recusa número cru antes de qualquer chamada", async () => {
    dublar(() => json(pedidoApi([cobranca({ payment_method: { type: "CREDIT_CARD" } })]), 201));
    const ok = await provedor({ descritorFatura: "Loja Exemplo" }).cobrar(
      pedido("cartao", { cartao: { token: CIFRADO, parcelas: 2 } }),
      3140,
    );
    const charges = (corpo(chamadas[0]).charges as { payment_method: Record<string, unknown> }[]);
    const metodo = charges[0].payment_method;
    assert.equal(metodo.type, "CREDIT_CARD");
    assert.equal(metodo.installments, 2);
    assert.equal(metodo.capture, true);
    assert.equal(metodo.soft_descriptor, "Loja Exemplo");
    assert.deepEqual(metodo.card, { encrypted: CIFRADO, store: false });
    assert.equal(ok.status, "aprovado");

    chamadas = [];
    await assert.rejects(
      provedor().cobrar(pedido("cartao", { cartao: { token: "4111111111111111", parcelas: 1 } }), 3140),
      CobrancaRecusada,
    );
    assert.equal(chamadas.length, 0);
  });

  it("boleto pede endereço, respeita o mínimo de 20 centavos e devolve a linha digitável", async () => {
    dublar(() =>
      json(
        pedidoApi([
          cobranca({
            status: "WAITING",
            payment_method: {
              type: "BOLETO",
              boleto: { formatted_barcode: "08197.08108 00100.000017", due_date: "2026-10-16" },
            },
            links: [{ rel: "SELF", href: "https://boleto.pagseguro.com.br/teste.pdf", media: "application/pdf", type: "GET" }],
          }),
        ]),
        201,
      ),
    );

    const resultado = await provedor().cobrar(pedido("boleto"), 3140);
    const metodo = (corpo(chamadas[0]).charges as { payment_method: { type: string; boleto: { due_date: string; holder: { tax_id: string } } } }[])[0]
      .payment_method;
    assert.equal(metodo.type, "BOLETO");
    assert.match(metodo.boleto.due_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(metodo.boleto.holder.tax_id, "52998224725");
    assert.equal(resultado.boleto?.linhaDigitavel, "08197.08108 00100.000017");
    assert.equal(resultado.boleto?.url, "https://boleto.pagseguro.com.br/teste.pdf");
    assert.equal(resultado.status, "pendente");

    await assert.rejects(provedor().cobrar(pedido("boleto", { entrega: undefined }), 3140), /endereço/);
    await assert.rejects(provedor().cobrar(pedido("boleto"), 19), /0,20/);
  });

  it("4xx é recusa conclusiva; 409 e 5xx não são", async () => {
    for (const status of [400, 401, 422]) {
      dublar(() => json({ error_messages: [{ description: "invalid_parameter", parameter_name: "customer.tax_id" }] }, status));
      await assert.rejects(
        provedor().cobrar(pedido("pix"), 3140),
        (e) => e instanceof CobrancaRecusada && e.status === status,
        String(status),
      );
    }
    for (const status of [408, 409, 500]) {
      dublar(() => json({ error_messages: [{ description: "idempotency_key_in_use" }] }, status));
      await assert.rejects(
        provedor().cobrar(pedido("pix"), 3140),
        (e) => e instanceof Error && !(e instanceof CobrancaRecusada),
        String(status),
      );
    }
  });

  it("referência maior que 64 caracteres vira o mesmo hash na cobrança e na busca", async () => {
    const referencia = `pedido-${"a".repeat(80)}`;
    const ref = referenciaDaApi(referencia);
    assert.equal(ref.length, 64);
    assert.notEqual(ref, referencia);

    dublar(() => json(pedidoApi([cobranca({ reference_id: ref })], ref), 201));
    await provedor().cobrar(pedido("pix", { referencia }), 3140);
    assert.equal(corpo(chamadas[0]).reference_id, ref);

    chamadas = [];
    dublar(() => json({ orders: [pedidoApi([cobranca({ reference_id: ref, status: "PAID" })], ref)] }));
    const achado = await provedor().buscarPorReferencia(referencia);
    const url = new URL(chamadas[0].url);
    assert.equal(url.searchParams.get("reference_id"), ref);
    assert.equal(achado?.id, "CHAR_TESTE");
  });

  it("não manda URL de notificação que não seja https", async () => {
    dublar(() => json(pedidoApi([cobranca()]), 201));
    await provedor({ notificationUrl: "http://inseguro.example/hook" }).cobrar(pedido("pix"), 3140);
    assert.equal(corpo(chamadas[0]).notification_urls, undefined);
  });
});

describe("PagBankProvider: consulta, busca e estorno", () => {
  beforeEach(() => {
    chamadas = [];
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("consultar a cobrança usa GET /charges e traduz estorno parcial que continua PAID", async (t) => {
    const tempos = espiarTempoLimite(t);
    dublar(() =>
      json(cobranca({ amount: { value: 3140, summary: { total: 3140, paid: 3140, refunded: 1000 } }, payment_method: { type: "CREDIT_CARD" } })),
    );
    const resultado = await provedor().consultar("CHAR_TESTE");
    assert.deepEqual(tempos, [10_000]);
    assert.equal(chamadas[0].url, "https://api.pagseguro.com/charges/CHAR_TESTE");
    assert.equal(resultado.status, "aprovado");
    assert.equal(resultado.valor, 2140);
    assert.equal(resultado.meioPagamento, "cartao");
  });

  it("estorno total lê o valor restante e cancela com centavos; parcial manda o valor pedido", async (t) => {
    const tempos = espiarTempoLimite(t);
    dublar((chamada) => {
      if (chamada.url.endsWith("/cancel")) {
        return json(cobranca({ status: "CANCELED", amount: { value: 3140, summary: { total: 3140, paid: 3140, refunded: 3140 } } }));
      }
      return json(cobranca());
    });

    const total = await provedor().estornar("CHAR_TESTE");
    assert.deepEqual(tempos, [10_000, 20_000]);
    assert.equal(chamadas[0].url, "https://api.pagseguro.com/charges/CHAR_TESTE");
    assert.equal(chamadas[1].url, "https://api.pagseguro.com/charges/CHAR_TESTE/cancel");
    assert.deepEqual(corpo(chamadas[1]), { amount: { value: 3140 } });
    assert.equal(cabecalho(chamadas[1], "x-idempotency-key"), chaveDeIdempotencia("estornoCHAR_TESTE3140"));
    assert.equal(total.status, "estornado");

    chamadas = [];
    dublar(() => json(cobranca({ amount: { value: 3140, summary: { total: 3140, paid: 3140, refunded: 500 } } })));
    const parcial = await provedor().estornar("CHAR_TESTE", { valorEmCentavos: 500 });
    assert.equal(chamadas.length, 1);
    assert.deepEqual(corpo(chamadas[0]), { amount: { value: 500 } });
    assert.equal(parcial.status, "aprovado");
    assert.equal(parcial.valor, 2640);
  });

  it("busca pela referência exata, prefere a paga e trata 400 como erro", async (t) => {
    const tempos = espiarTempoLimite(t);
    dublar(() =>
      json({
        orders: [
          pedidoApi([cobranca({ id: "CHAR_NOVA", status: "WAITING", created_at: "2026-10-13T18:00:00.000-03:00" })]),
          pedidoApi([cobranca({ id: "CHAR_PAGA", status: "PAID", created_at: "2026-10-13T10:00:00.000-03:00" })]),
          pedidoApi([cobranca({ id: "CHAR_OUTRA", status: "PAID" })], "PED-10"),
        ],
      }),
    );
    const achado = await provedor().buscarPorReferencia("PED-1");
    assert.equal(achado?.id, "CHAR_PAGA");
    assert.equal(tempos.length, 1);
    assert.ok((tempos[0] ?? 0) > 0 && (tempos[0] ?? 0) <= 20_000);

    dublar(() => json({ orders: [] }));
    assert.equal(await provedor().buscarPorReferencia("PED-1"), null);

    dublar(() => json({ message: "invalid_parameter" }, 400));
    await assert.rejects(provedor().buscarPorReferencia("PED-1"));

    dublar(() => json({ inesperado: true }));
    await assert.rejects(provedor().buscarPorReferencia("PED-1"), /formato desconhecido/);
  });

  it("estourar o tempo rejeita a cobrança, a consulta e o estorno", async () => {
    const estouro = () => Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    dublar(estouro);
    await assert.rejects(provedor().cobrar(pedido("pix"), 3140), { name: "TimeoutError" });
    await assert.rejects(provedor().consultar("CHAR_TESTE"), { name: "TimeoutError" });
    await assert.rejects(provedor().estornar("CHAR_TESTE", { valorEmCentavos: 100 }), { name: "TimeoutError" });
  });
});

describe("PagBankProvider: webhook", () => {
  beforeEach(() => {
    chamadas = [];
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("aceita a assinatura SHA-256 e devolve a cobrança paga", async () => {
    const corpoBruto = JSON.stringify(
      pedidoApi([
        cobranca({ id: "CHAR_RECUSADA", status: "DECLINED", created_at: "2026-10-13T18:00:00.000-03:00" }),
        cobranca({ id: "CHAR_PAGA", status: "PAID", created_at: "2026-10-13T10:00:00.000-03:00" }),
      ]),
    );
    const valida = assinar(corpoBruto);
    const id = await provedor().validarWebhook({
      corpoBruto,
      cabecalhos: { "x-payload-signature": `lixo-invalido, ${valida}` },
    });
    assert.deepEqual(id, { pagamentoId: "CHAR_PAGA" });
    assert.equal(chamadas.length, 0);
  });

  it("rejeita corpo alterado, header ausente e o modelo antigo do token", async () => {
    const corpoBruto = JSON.stringify(pedidoApi([cobranca()]));
    const valida = assinar(corpoBruto);
    assert.equal(
      await provedor().validarWebhook({ corpoBruto: `${corpoBruto} `, cabecalhos: { "x-payload-signature": valida } }),
      null,
    );
    assert.equal(await provedor().validarWebhook({ corpoBruto, cabecalhos: {} }), null);
    assert.equal(
      await provedor().validarWebhook({ corpoBruto, cabecalhos: { "x-authenticity-token": valida } }),
      null,
    );
  });

  it("sem chave na config, busca GET /public-keys/webhook uma vez e reutiliza", async () => {
    const semChave = new PagBankProvider({ accessToken: "TEST-token" });
    const corpoBruto = JSON.stringify(cobranca({ id: "CHAR_AVULSA" }));
    const valida = assinar(corpoBruto);
    let buscas = 0;
    dublar(() => {
      buscas += 1;
      return json({ public_key: CHAVE_PUBLICA });
    });
    const primeiro = await semChave.validarWebhook({ corpoBruto, cabecalhos: { "X-Payload-Signature": valida } });
    const segundo = await semChave.validarWebhook({ corpoBruto, cabecalhos: { "X-Payload-Signature": valida } });
    assert.deepEqual(primeiro, { pagamentoId: "CHAR_AVULSA" });
    assert.deepEqual(segundo, { pagamentoId: "CHAR_AVULSA" });
    assert.equal(buscas, 1);
    assert.equal(chamadas[0].url, "https://api.pagseguro.com/public-keys/webhook");
  });
});

describe("definição do PagBank", () => {
  beforeEach(() => {
    chamadas = [];
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("é OAuth, confirmação automática, e testarConexao fala português sem lançar", async () => {
    assert.equal(definicaoPagBank.tipoConexao, "oauth");
    assert.equal(definicaoPagBank.capacidades.confirmacaoAutomatica, true);
    assert.equal(definicaoPagBank.campos.length, 0);
    assert.throws(() => definicaoPagBank.criar({ segredos: {}, publicos: {} }), /access token/);

    const semToken = await definicaoPagBank.testarConexao({ segredos: {}, publicos: {} });
    assert.equal(semToken.ok, false);
    assert.match(semToken.mensagem, /Conecte o PagBank/);

    dublar(() => json({ public_key: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE" }));
    const ok = await definicaoPagBank.testarConexao({ segredos: { accessToken: "TEST-abc", ambiente: "sandbox" }, publicos: {} });
    assert.equal(ok.ok, true);
    assert.equal(ok.mensagem, "Conta conectada e pronta para receber.");
    assert.equal(ok.avisos.length, 2);
    assert.equal(chamadas[0].url, "https://sandbox.api.pagseguro.com/public-keys/card");

    dublar(() => json({ message: "unauthorized" }, 401));
    const recusa = await definicaoPagBank.testarConexao({ segredos: { accessToken: "TEST-abc" }, publicos: {} });
    assert.equal(recusa.ok, false);
    assert.match(recusa.mensagem, /recusou o acesso/);

    dublar(() => Promise.reject(new Error("rede")));
    const rede = await definicaoPagBank.testarConexao({ segredos: { accessToken: "TEST-abc" }, publicos: {} });
    assert.equal(rede.ok, false);
    assert.match(rede.mensagem, /Não consegui falar com o PagBank/);
  });

  it("sandbox sai da credencial; produção é o padrão", async () => {
    dublar(() => json(cobranca()));
    const sandbox = definicaoPagBank.criar({ segredos: { accessToken: "TEST-abc", ambiente: "sandbox" }, publicos: {} });
    assert.ok(sandbox instanceof PagBankProvider);
    await sandbox.consultar("CHAR_TESTE");
    assert.equal(chamadas[0].url, "https://sandbox.api.pagseguro.com/charges/CHAR_TESTE");

    chamadas = [];
    const producao = definicaoPagBank.criar({ segredos: { accessToken: "TEST-abc" }, publicos: {} });
    await producao.consultar("CHAR_TESTE");
    assert.equal(chamadas[0].url, "https://api.pagseguro.com/charges/CHAR_TESTE");
  });

  it("chave de cartão ausente não derruba a conexão; erro de servidor derruba", async () => {
    dublar(() => json({ message: "not found" }, 404));
    const ausente = await definicaoPagBank.testarConexao({ segredos: { accessToken: "TEST-abc" }, publicos: {} });
    assert.equal(ausente.ok, true);
    if (ausente.ok) assert.match(ausente.avisos.join(" "), /chave pública do cartão/);

    dublar(() => json({}, 400));
    const pedidoInvalido = await definicaoPagBank.testarConexao({ segredos: { accessToken: "TEST-abc" }, publicos: {} });
    assert.equal(pedidoInvalido.ok, true);

    dublar(() => json({}, 500));
    const servidor = await definicaoPagBank.testarConexao({ segredos: { accessToken: "TEST-abc" }, publicos: {} });
    assert.equal(servidor.ok, false);
    if (!servidor.ok) assert.match(servidor.mensagem, /erro \(500\)/);
  });

  it("criar repassa a notificationUrl do contexto", async () => {
    dublar(() => json(pedidoApi([cobranca()])));
    const url = "https://lojas.avilaops.com/api/webhooks/pagamentos/pagbank/tok";
    const provider = definicaoPagBank.criar({ segredos: { accessToken: "TEST-abc" }, publicos: {}, notificationUrl: url });
    await provider.cobrar(pedido("pix"), 3140);
    const enviada = chamadas[0];
    assert.ok(enviada);
    assert.deepEqual(corpo(enviada).notification_urls, [url]);
  });
});
