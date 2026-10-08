import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOLGA_MULTIPART_BYTES,
  TETO_IMAGEM_BYTES,
  TETO_IMAGEM_URL_BYTES,
  TETO_PLANILHA_BYTES,
  UploadInvalido,
  corpoAcimaDoTeto,
  lerComTeto,
} from "./limites-upload";

const TETO = 1000;

function pedido(contentLength?: string) {
  return { headers: new Headers(contentLength === undefined ? {} : { "content-length": contentLength }) };
}

/** Fluxo que entrega um pedaço por leitura e conta quantos saíram. */
function fluxoContado(pedacos: Uint8Array[]) {
  const estado = { entregues: 0, cancelado: false };
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controle) {
        const proximo = pedacos[estado.entregues];
        if (!proximo) return controle.close();
        estado.entregues += 1;
        controle.enqueue(proximo);
      },
      cancel() {
        estado.cancelado = true;
      },
    },
    // Sem fila adiantada: o fluxo só produz quando o leitor pede.
    { highWaterMark: 0 },
  );
  return { body, estado };
}

test("os tetos são os que o código já aplicava", () => {
  assert.equal(TETO_IMAGEM_BYTES, 5 * 1024 * 1024);
  assert.equal(TETO_IMAGEM_URL_BYTES, 10 * 1024 * 1024);
  assert.equal(TETO_PLANILHA_BYTES, 12 * 1024 * 1024);
});

test("corpoAcimaDoTeto: abaixo do teto passa", () => {
  assert.equal(corpoAcimaDoTeto(pedido("999"), TETO), false);
});

test("corpoAcimaDoTeto: igual ao teto passa", () => {
  assert.equal(corpoAcimaDoTeto(pedido(String(TETO)), TETO), false);
});

test("corpoAcimaDoTeto: dentro da folga do multipart passa", () => {
  assert.equal(corpoAcimaDoTeto(pedido(String(TETO + 1)), TETO), false);
  assert.equal(corpoAcimaDoTeto(pedido(String(TETO + FOLGA_MULTIPART_BYTES)), TETO), false);
});

test("corpoAcimaDoTeto: acima do teto mais a folga é recusado", () => {
  assert.equal(corpoAcimaDoTeto(pedido(String(TETO + FOLGA_MULTIPART_BYTES + 1)), TETO), true);
  assert.equal(corpoAcimaDoTeto(pedido(String(500 * 1024 * 1024)), TETO_IMAGEM_BYTES), true);
});

test("corpoAcimaDoTeto: cabeçalho ausente não recusa", () => {
  assert.equal(corpoAcimaDoTeto(pedido(), TETO), false);
});

test("corpoAcimaDoTeto: cabeçalho não numérico não recusa", () => {
  for (const valor of ["abc", "", "-5", "1e9", "12.5", "999999999999 bytes"]) {
    assert.equal(corpoAcimaDoTeto(pedido(valor), TETO), false, `content-length "${valor}"`);
  }
});

test("lerComTeto: corpo menor que o teto volta com os mesmos bytes", async () => {
  const { body } = fluxoContado([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
  const lido = await lerComTeto({ body }, 10);
  assert.deepEqual([...lido], [1, 2, 3, 4, 5]);
});

test("lerComTeto: corpo exatamente no teto passa", async () => {
  const { body } = fluxoContado([new Uint8Array(6), new Uint8Array(4)]);
  assert.equal((await lerComTeto({ body }, 10)).length, 10);
});

test("lerComTeto: corpo maior sem content-length lança e não lê até o fim", async () => {
  const pedacos = Array.from({ length: 50 }, () => new Uint8Array(4));
  const { body, estado } = fluxoContado(pedacos);
  await assert.rejects(lerComTeto({ body }, 10, "Imagem acima de 10 MB."), (erro: unknown) => {
    assert.ok(erro instanceof UploadInvalido);
    assert.equal(erro.message, "Imagem acima de 10 MB.");
    return true;
  });
  // 4 + 4 + 4 = 12 > 10: o terceiro pedaço estoura e a leitura para ali.
  assert.equal(estado.entregues, 3);
  assert.equal(estado.cancelado, true);
});

test("lerComTeto: resposta sem corpo devolve buffer vazio", async () => {
  const lido = await lerComTeto({ body: null }, 10);
  assert.ok(Buffer.isBuffer(lido));
  assert.equal(lido.length, 0);
});

test("lerComTeto: lê uma Response de verdade", async () => {
  const lido = await lerComTeto(new Response("abc"), 10);
  assert.equal(lido.toString("utf8"), "abc");
  await assert.rejects(lerComTeto(new Response("x".repeat(11)), 10), UploadInvalido);
});
