import assert from "node:assert/strict";
import test from "node:test";
import { definicaoMercadoPago } from "./mercadopago-definicao.ts";
import { MercadoPagoProvider } from "./mercadopago.ts";
import { RegistroDeProvedores } from "./registro.ts";
import { ehProvedor, PROVEDORES } from "./types.ts";

test("registro devolve a definição pelo id e recusa duplicata e desconhecido", () => {
  const r = new RegistroDeProvedores().registrar(definicaoMercadoPago);
  assert.equal(r.obter("mercadopago").nome, "Mercado Pago");
  assert.equal(r.tem("mercadopago"), true);
  assert.equal(r.tem("pagbank"), false);
  assert.throws(() => r.obter("pagbank"), /não registrado/);
  assert.throws(() => r.registrar(definicaoMercadoPago), /duas vezes/);
  assert.deepEqual(r.listar().map((d) => d.id), ["mercadopago"]);
});

test("ids de provedor são fixos", () => {
  assert.deepEqual([...PROVEDORES], ["mercadopago", "pagbank", "pagarme", "cielo", "pix_manual"]);
  assert.equal(ehProvedor("pix_manual"), true);
  assert.equal(ehProvedor("nubank"), false);
});

test("Mercado Pago pelo registro: mesmo adaptador, confirmação automática, exige token", () => {
  const p = definicaoMercadoPago.criar({ segredos: { accessToken: "TEST-x" }, publicos: {}, notificationUrl: "https://x/y" });
  assert.ok(p instanceof MercadoPagoProvider);
  assert.equal(definicaoMercadoPago.capacidades.confirmacaoAutomatica, true);
  assert.throws(() => definicaoMercadoPago.criar({ segredos: {}, publicos: {} }), /access token/);
});

test("Mercado Pago declara conexão por OAuth e testarConexao não lança sem token", async () => {
  assert.equal(definicaoMercadoPago.tipoConexao, "oauth");
  const r = await definicaoMercadoPago.testarConexao({ segredos: {}, publicos: {} });
  assert.equal(r.ok, false);
});
