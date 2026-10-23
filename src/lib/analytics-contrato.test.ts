import assert from "node:assert/strict";
import test from "node:test";
import { eventoFunilDaVitrine, TIPOS_EVENTO_ANALYTICS } from "./analytics-contrato";

test("contrato documenta todas as etapas do funil", () => {
  for (const evento of ["search", "search_no_results", "filter_apply", "view_item", "technical_contact", "add_to_cart", "view_cart", "begin_checkout", "purchase"])
    assert.ok(TIPOS_EVENTO_ANALYTICS.includes(evento as never), evento);
});

test("entrada pública aceita só o nome controlado e recusa dados pessoais", () => {
  assert.deepEqual(eventoFunilDaVitrine.parse({ event: "search" }), { event: "search" });
  assert.equal(eventoFunilDaVitrine.safeParse({ event: "purchase" }).success, false, "navegador não declara compra");
  assert.equal(eventoFunilDaVitrine.safeParse({ event: "search", termo: "CPF 123" }).success, false);
});

