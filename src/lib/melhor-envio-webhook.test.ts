import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { alvoPedidoMelhorEnvio, assinaturaMelhorEnvioValida, statusPostagemMelhorEnvio, STATUS_MELHOR_ENVIO, transicoesPedidoMelhorEnvio } from "./melhor-envio-webhook";

test("valida somente a assinatura HMAC do corpo exato", () => {
  const corpo = JSON.stringify({ event: "order.posted", data: { id: "shipment-1" } });
  const assinatura = createHmac("sha256", "segredo-teste").update(corpo).digest("base64");
  assert.equal(assinaturaMelhorEnvioValida(corpo, assinatura, "segredo-teste"), true);
  assert.equal(assinaturaMelhorEnvioValida(`${corpo} `, assinatura, "segredo-teste"), false);
  assert.equal(assinaturaMelhorEnvioValida(corpo, assinatura, "outro-segredo"), false);
  assert.equal(assinaturaMelhorEnvioValida(corpo, null, "segredo-teste"), false);
});

test("mantém somente status de pedido documentados no webhook", () => {
  assert.equal(STATUS_MELHOR_ENVIO.has("posted"), true);
  assert.equal(STATUS_MELHOR_ENVIO.has("delivered"), true);
  assert.equal(STATUS_MELHOR_ENVIO.has("payment_approved"), false);
});

test("não regride o status local da postagem com webhook atrasado", () => {
  assert.equal(statusPostagemMelhorEnvio("carrinho", "pending"), "carrinho");
  assert.equal(statusPostagemMelhorEnvio("comprada", "released"), "comprada");
  assert.equal(statusPostagemMelhorEnvio("gerada", "received"), "gerada");
  assert.equal(statusPostagemMelhorEnvio("emitida", "released"), "emitida");
  assert.equal(statusPostagemMelhorEnvio("cancelada", "generated"), "cancelada");
  assert.equal(statusPostagemMelhorEnvio("gerada", "posted"), "emitida");
});

test("traduz eventos do provedor em transições válidas do pedido", () => {
  assert.equal(alvoPedidoMelhorEnvio("PAGO", "pending"), null);
  assert.equal(alvoPedidoMelhorEnvio("PAGO", "posted"), "ENVIADO");
  assert.equal(alvoPedidoMelhorEnvio("CANCELADO", "delivered"), null);
  assert.deepEqual(transicoesPedidoMelhorEnvio("PAGO", "ENTREGUE"), ["EM_SEPARACAO", "ENVIADO", "ENTREGUE"]);
  assert.deepEqual(transicoesPedidoMelhorEnvio("ENVIADO", "ENTREGUE"), ["ENTREGUE"]);
});
