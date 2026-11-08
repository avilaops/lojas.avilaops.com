import assert from "node:assert/strict";
import test from "node:test";
import { atalhosDoPainel, buscarAtalhosDoPainel } from "./navegacao-painel";

const recursos = { pixManual: false, configuradorSobMedida: false };

test("busca alcança subseções e configurações sem repetir destinos", () => {
  const atalhos = atalhosDoPainel(recursos);
  assert.ok(atalhos.some((item) => item.href === "/painel/produtos/categorias"));
  assert.ok(atalhos.some((item) => item.href === "/painel/analises/atribuicao"));
  assert.ok(atalhos.some((item) => item.href === "/painel/configuracoes"));
  assert.equal(new Set(atalhos.map((item) => item.href)).size, atalhos.length);
});

test("busca reconhece rótulos com acentos e caixa diferente", () => {
  assert.ok(buscarAtalhosDoPainel("  ATRIBUICAO ", recursos).some((item) => item.href === "/painel/analises/atribuicao"));
  assert.ok(buscarAtalhosDoPainel("configuracoes", recursos).some((item) => item.href === "/painel/configuracoes"));
});

test("atalhos respeitam recursos habilitados na loja", () => {
  const comuns = atalhosDoPainel(recursos);
  assert.ok(!comuns.some((item) => item.href === "/painel/pedidos/pix"));
  assert.ok(!comuns.some((item) => item.href === "/painel/sob-medida"));
  const habilitados = atalhosDoPainel({ pixManual: true, configuradorSobMedida: true });
  assert.ok(habilitados.some((item) => item.href === "/painel/pedidos/pix"));
  assert.ok(habilitados.some((item) => item.href === "/painel/sob-medida"));
});
