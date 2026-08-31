import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import { lojaVende } from "./tenant";

/**
 * `lojaVende` decide se a loja mostra "Finalizar compra" ou "Pedir pelo
 * WhatsApp". Errar para mais é o pior dos dois: o comprador percorre o
 * checkout inteiro e descobre no fim que não dá para pagar.
 */
function loja(parcial: Partial<Tenant>): Tenant {
  return { status: "ATIVA", plano: "LOJA", mpAccessTokenEnc: "v1.x.y.z", ...parcial } as Tenant;
}

test("loja ativa, com plano de venda e credencial, vende", () => {
  assert.equal(lojaVende(loja({})), true);
});

test("sem credencial de pagamento não vende, mesmo ativa", () => {
  // É o caso das lojas-demo: vitrine completa, pedido pelo WhatsApp.
  assert.equal(lojaVende(loja({ mpAccessTokenEnc: null })), false);
});

test("plano Site nunca vende, mesmo com credencial", () => {
  assert.equal(lojaVende(loja({ plano: "SITE" })), false);
});

test("loja suspensa não vende: a vitrine fica, o checkout some", () => {
  assert.equal(lojaVende(loja({ status: "SUSPENSA" })), false);
});

test("loja em provisionamento ou cancelada não vende", () => {
  assert.equal(lojaVende(loja({ status: "PROVISIONANDO" })), false);
  assert.equal(lojaVende(loja({ status: "CANCELADA" })), false);
});
