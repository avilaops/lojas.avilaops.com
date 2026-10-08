import assert from "node:assert/strict";
import test from "node:test";
import {
  ESPERAS_MIN,
  TENTATIVAS_MAXIMAS,
  assinar,
  conferirAssinatura,
  enderecoPrivado,
  entregou,
  eventosValidos,
  gerarSegredoDeWebhook,
  motivoDaRecusa,
  proximaTentativa,
} from "./webhooks-api";

/**
 * O webhook faz o NOSSO servidor requisitar um endereço que o lojista digitou.
 * Cada teste de endereço aqui é um jeito de usar isso para alcançar o que está
 * atrás do nosso firewall.
 */

test("endereço público em https serve", () => {
  for (const u of ["https://erp.exemplo.com.br/webhooks/lojas", "https://hooks.exemplo.com:8443/x?y=1"]) {
    assert.equal(motivoDaRecusa(u), null, u);
  }
});

test("endereço recusado: http, credencial, IP escrito, nome interno e lixo", () => {
  for (const u of [
    "http://erp.exemplo.com/webhook",
    "https://usuario:senha@erp.exemplo.com/webhook",
    "https://127.0.0.1/webhook",
    "https://10.0.0.5/admin",
    "https://[::1]/webhook",
    "https://localhost/webhook",
    "https://banco/webhook",
    "https://servico.internal/webhook",
    "https://impressora.local/",
    "https://erp.exemplo.com/webhook#fragmento",
    "ftp://erp.exemplo.com/",
    "nada",
    "",
  ]) {
    assert.notEqual(motivoDaRecusa(u), null, u);
  }
});

test("endereço privado é reconhecido em IPv4, IPv4 mapeado e IPv6", () => {
  for (const ip of ["10.1.2.3", "127.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:10.0.0.1", "fd00::1", "fe80::1", "224.0.0.1"]) {
    assert.equal(enderecoPrivado(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "172.15.0.1", "100.63.0.1", "178.105.82.48", "2606:4700::1111"]) {
    assert.equal(enderecoPrivado(ip), false, ip);
  }
  // O que não parece IP não passa por público.
  assert.equal(enderecoPrivado("exemplo.com"), true);
});

test("assinatura confere com o segredo e o corpo certos, dentro da tolerância", () => {
  const segredo = gerarSegredoDeWebhook();
  assert.match(segredo, /^whsec_[0-9a-f]{48}$/);
  const corpo = JSON.stringify({ id: "evt_1", tipo: "pedido.pago" });
  const agora = 1_800_000_000_000;
  const cabecalho = assinar(segredo, corpo, agora);
  assert.match(cabecalho, /^t=1800000000,v1=[0-9a-f]{64}$/);

  assert.equal(conferirAssinatura(segredo, corpo, cabecalho, agora), true);
  assert.equal(conferirAssinatura(segredo, corpo, cabecalho, agora + 299_000), true);
  // Corpo adulterado, outro segredo e requisição velha reapresentada.
  assert.equal(conferirAssinatura(segredo, corpo.replace("pago", "cancelado"), cabecalho, agora), false);
  assert.equal(conferirAssinatura(gerarSegredoDeWebhook(), corpo, cabecalho, agora), false);
  assert.equal(conferirAssinatura(segredo, corpo, cabecalho, agora + 301_000), false);
  assert.equal(conferirAssinatura(segredo, corpo, "lixo", agora), false);
});

test("novas tentativas se espaçam e acabam", () => {
  const agora = new Date("2026-10-08T12:00:00Z");
  assert.equal(proximaTentativa(1, agora)?.toISOString(), "2026-10-08T12:01:00.000Z");
  assert.equal(proximaTentativa(2, agora)?.toISOString(), "2026-10-08T12:05:00.000Z");
  assert.equal(proximaTentativa(ESPERAS_MIN.length, agora)?.getTime(), agora.getTime() + 960 * 60_000);
  assert.equal(proximaTentativa(TENTATIVAS_MAXIMAS, agora), null);
  for (let i = 1; i < ESPERAS_MIN.length; i++) assert.ok(ESPERAS_MIN[i] > ESPERAS_MIN[i - 1]);
});

test("só 2xx é entrega; redirecionamento não é", () => {
  for (const s of [200, 201, 204]) assert.equal(entregou(s), true);
  for (const s of [301, 302, 400, 401, 404, 500, 503]) assert.equal(entregou(s), false);
});

test("assinatura de eventos: só os que existem, sem repetir, na ordem do catálogo", () => {
  assert.deepEqual(eventosValidos(["pedido.enviado", "pedido.pago", "pedido.pago", "loja.suspensa", "operacao.alerta", 7]), ["pedido.pago", "pedido.enviado"]);
  assert.deepEqual(eventosValidos([]), []);
});
