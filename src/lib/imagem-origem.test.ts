import assert from "node:assert/strict";
import test from "node:test";
import { avisoDaImagem, seloDaImagem } from "./imagem-origem";

/**
 * A declaração de origem da imagem existe para que foto de série não passe
 * por foto do item. Ela valia só na página do produto; o card, que é onde a
 * mesma foto se repete dez vezes na grade, não dizia nada.
 */
test("foto própria não avisa nada: é o padrão", () => {
  assert.equal(seloDaImagem("propria", true), null);
  assert.equal(avisoDaImagem("propria", true), null);
});

test("foto de série e ilustração avisam nos dois lugares", () => {
  assert.equal(seloDaImagem("representativa", true), "Foto da série");
  assert.equal(seloDaImagem("ilustracao", true), "Ilustração");
  assert.match(avisoDaImagem("representativa", true) ?? "", /representativa da série/);
  assert.match(avisoDaImagem("ilustracao", true) ?? "", /não é foto do produto/);
});

test("sem foto não há o que declarar", () => {
  // A vitrine já diz "Imagem em preparação", e é a mesma regra que o banco
  // aplica na escrita: origem declarada sem imagem é recusada.
  assert.equal(seloDaImagem("representativa", false), null);
  assert.equal(avisoDaImagem("ilustracao", false), null);
});

test("origem desconhecida não inventa texto", () => {
  // Valor novo gravado por importação antiga não pode virar selo em branco.
  assert.equal(seloDaImagem("fornecedor", true), null);
  assert.equal(seloDaImagem(null, true), null);
  assert.equal(seloDaImagem(undefined, true), null);
});
