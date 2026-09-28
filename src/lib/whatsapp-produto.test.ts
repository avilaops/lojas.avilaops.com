import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemDoProduto } from "./whatsapp-produto";

test("orçamento leva nome, SKU e URL oficial da loja", () => {
  const mensagem = mensagemDoProduto({ nome: "Rolamento 6204 2RSC3", sku: "5465", slug: "rolamento-6204" }, "https://pecas.example/");
  assert.equal(mensagem, "Olá! Tenho interesse neste produto:\nRolamento 6204 2RSC3\nCódigo: 5465\nhttps://pecas.example/produtos/rolamento-6204");
});

test("consulta de preço preserva outra loja e não inventa código ausente", () => {
  const mensagem = mensagemDoProduto({ nome: "Correia A & B", sku: null, slug: "correia" }, "https://outra.example", true);
  assert.ok(mensagem.startsWith("Olá! Quero consultar o preço"));
  assert.ok(mensagem.endsWith("https://outra.example/produtos/correia"));
  assert.ok(!mensagem.includes("Código:"));
});
