import assert from "node:assert/strict";
import test from "node:test";
import { ALERTAS } from "./alertas";
import { eventIdDaChave } from "./eventos";
import { statusDepoisDoAviso } from "./mercadolivre-pedidos";

test("o id do evento sai do fato: mesmo fato, mesmo id; qualquer diferença, outro id", () => {
  const id = eventIdDaChave("pedido.pago", "brilhax", "pago:abc");
  assert.match(id, /^evt_[0-9a-f]{32}$/);
  assert.equal(eventIdDaChave("pedido.pago", "brilhax", "pago:abc"), id);
  assert.notEqual(eventIdDaChave("pedido.pago", "vedashow", "pago:abc"), id);
  assert.notEqual(eventIdDaChave("pedido.recusado", "brilhax", "pago:abc"), id);
  assert.notEqual(eventIdDaChave("pedido.pago", "brilhax", "pago:abd"), id);
  // O separador não deixa um campo invadir o outro.
  assert.notEqual(eventIdDaChave("a", "b|c", "d"), eventIdDaChave("a|b", "c", "d"));
});

test("aviso repetido do canal não desfaz o que a loja já andou com o pedido", () => {
  // O ML manda a ordem de novo a cada mudança; ela só diz "pago".
  assert.equal(statusDepoisDoAviso("ENVIADO", "PAGO"), "ENVIADO");
  assert.equal(statusDepoisDoAviso("EM_SEPARACAO", "PAGO"), "EM_SEPARACAO");
  assert.equal(statusDepoisDoAviso("ENTREGUE", "PAGO"), "ENTREGUE");
  assert.equal(statusDepoisDoAviso("PAGO", "AGUARDANDO_PAGAMENTO"), "PAGO");
  // O que o aviso traz de novo entra.
  assert.equal(statusDepoisDoAviso("AGUARDANDO_PAGAMENTO", "PAGO"), "PAGO");
  assert.equal(statusDepoisDoAviso("PAGO", "PAGO"), "PAGO");
});

test("cancelamento no canal vale sempre, e pedido encerrado não ressuscita", () => {
  assert.equal(statusDepoisDoAviso("ENVIADO", "CANCELADO"), "CANCELADO");
  assert.equal(statusDepoisDoAviso("AGUARDANDO_PAGAMENTO", "CANCELADO"), "CANCELADO");
  assert.equal(statusDepoisDoAviso("CANCELADO", "PAGO"), "CANCELADO");
  assert.equal(statusDepoisDoAviso("ESTORNADO", "PAGO"), "ESTORNADO");
});

test("todo alerta diz o que quebrou e o que fazer, em frase que se lê sozinha", () => {
  for (const [codigo, texto] of Object.entries(ALERTAS)) {
    assert.match(codigo, /^[a-z]+\.[a-z-]+$/, codigo);
    assert.ok(texto.oQueQuebrou.length > 30 && texto.oQueQuebrou.endsWith("."), codigo);
    assert.ok(texto.oQueFazer.length > 30 && texto.oQueFazer.endsWith("."), codigo);
  }
});
