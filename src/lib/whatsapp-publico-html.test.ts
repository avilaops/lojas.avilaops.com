import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WhatsAppFlutuante, { linkWhatsApp } from "@/components/WhatsAppFlutuante";

test("link de WhatsApp nacional aponta para o número internacional e preserva a mensagem", () => {
  const url = new URL(linkWhatsApp("(16) 3441-3180", "Olá! Medida 10 x 20 & código #1"));
  assert.equal(url.origin + url.pathname, "https://wa.me/551634413180");
  assert.equal(url.searchParams.get("text"), "Olá! Medida 10 x 20 & código #1");
});

test("canal inválido não renderiza botão flutuante nem gera destino externo", () => {
  assert.equal(renderToStaticMarkup(createElement(WhatsAppFlutuante, { numero: "inválido", nome: "Loja" })), "");
  assert.equal(linkWhatsApp("inválido", "Olá!"), "/contato");
});

test("DDI explícito de outro país não recebe prefixo brasileiro", () => {
  assert.equal(new URL(linkWhatsApp("+1 202 555 0123", "Olá!")).pathname, "/12025550123");
  assert.equal(new URL(linkWhatsApp("+44 20 7946 0958", "Olá!")).pathname, "/442079460958");
});
