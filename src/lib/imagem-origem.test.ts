import assert from "node:assert/strict";
import test from "node:test";
import { avisoDaImagem, declaracaoDaImagem, seloDaImagem } from "./imagem-origem";

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

/**
 * O painel passou a oferecer a declaração. O que ele envia obedece às mesmas
 * duas regras da escrita, para o formulário não conseguir gravar o que o
 * `CHECK` do banco recusaria — nem deixar rastro que mente.
 */
test("sem foto não há o que declarar", () => {
  assert.deepEqual(declaracaoDaImagem([], "representativa", "6200"), { imagemOrigem: "propria", imagemFamilia: null });
  assert.deepEqual(declaracaoDaImagem([], "ilustracao", ""), { imagemOrigem: "propria", imagemFamilia: null });
});

test("a família acompanha a foto de série, e só ela", () => {
  assert.deepEqual(declaracaoDaImagem(["/a.webp"], "representativa", "6200"), { imagemOrigem: "representativa", imagemFamilia: "6200" });
  // Trocou para foto própria: a família não pode ficar pendurada, senão a
  // auditoria de quem herdou a imagem passa a apontar para quem não herdou.
  assert.deepEqual(declaracaoDaImagem(["/a.webp"], "propria", "6200"), { imagemOrigem: "propria", imagemFamilia: null });
  assert.deepEqual(declaracaoDaImagem(["/a.webp"], "ilustracao", "6200"), { imagemOrigem: "ilustracao", imagemFamilia: null });
});

test("série em branco é série ausente, não string vazia", () => {
  // O `CHECK` recusa representativa sem família: mandar "" seria mandar o
  // formulário tomar um 422 em vez de o campo cobrar na tela.
  assert.deepEqual(declaracaoDaImagem(["/a.webp"], "representativa", "   "), { imagemOrigem: "representativa", imagemFamilia: null });
});
