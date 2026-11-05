import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WhatsAppFlutuante, { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import type { Tenant } from "@prisma/client";
import { comporHome } from "@/components/home/composicao";
import { tenantPublico } from "./tenant";
import { VALORES_LAYOUT } from "./tema";
import { lerIdentidade } from "./identidade";

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

test("todos os layouts recebem o mesmo WhatsApp público do carrinho sem alterar o cadastro", () => {
  for (const [whatsapp, esperado] of [
    ["ligue 1634413180", null],
    ["https://wa.me/551634413180", null],
    ["(16) 3441-3180", "551634413180"],
    ["+1 202 555 0123", "+12025550123"],
  ]) {
    const t = { nome: "Loja de teste", whatsapp, status: "ATIVA", plano: "SITE" } as Tenant;
    for (const layout of VALORES_LAYOUT) {
      const home = comporHome({ layout }, {
        t, identidade: lerIdentidade(null), categorias: [], vitrine: [], temDestaques: false, vende: false,
      });
      const props = home.props as { t: Tenant };
      assert.equal(props.t.whatsapp, esperado, layout);
      assert.equal(props.t.whatsapp, tenantPublico(t).whatsapp, layout);
      assert.equal(t.whatsapp, whatsapp, "a projeção não deve modificar o tenant original");
    }
  }
});
