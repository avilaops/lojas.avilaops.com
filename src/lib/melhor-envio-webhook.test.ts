import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { assinaturaMelhorEnvioValida, STATUS_MELHOR_ENVIO } from "./melhor-envio-webhook";

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
