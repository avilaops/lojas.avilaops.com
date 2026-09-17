import { test } from "node:test";
import assert from "node:assert/strict";
import { emParagrafos, minutosDeLeitura, resumoDe } from "./publicacoes";

test("resumo escrito pelo lojista vence o corte automático", () => {
  assert.equal(resumoDe({ resumo: "A chamada certa.", corpo: "Outra coisa bem maior." }), "A chamada certa.");
  // Resumo em branco não conta como escrito.
  assert.equal(resumoDe({ resumo: "   ", corpo: "O corpo." }), "O corpo.");
});

test("sem resumo, o corte cai no fim de uma frase", () => {
  const corpo = "Trocar o óleo a cada mil quilômetros é o que o manual pede. O resto é conversa de oficina e não vale para toda moto.";
  const r = resumoDe({ resumo: null, corpo }, 80);
  assert.equal(r, "Trocar o óleo a cada mil quilômetros é o que o manual pede.");
  // Sem reticências: cortou onde a frase acabou.
  assert.doesNotMatch(r, /…$/);
});

test("frase longa demais cai na palavra, nunca no meio dela", () => {
  const corpo = "Uma frase única e bastante comprida que nunca termina antes do limite estabelecido pelo chamador";
  const r = resumoDe({ resumo: null, corpo }, 40);
  assert.match(r, /…$/);
  assert.ok(r.length <= 41, `resumo ficou com ${r.length}`);
  // Não corta palavra ao meio: o que sobrou existe no texto original.
  assert.ok(corpo.startsWith(r.replace("…", "")));
});

test("corpo curto vira o resumo inteiro, sem reticências", () => {
  assert.equal(resumoDe({ resumo: null, corpo: "Nota curta." }, 200), "Nota curta.");
});

test("parágrafos saem por linha em branco, sem interpretar marcação", () => {
  assert.deepEqual(emParagrafos("um\n\ndois"), ["um", "dois"]);
  assert.deepEqual(emParagrafos("<b>oi</b>"), ["<b>oi</b>"]);
  assert.deepEqual(emParagrafos("   \n\n  "), []);
});

test("tempo de leitura nunca é zero", () => {
  assert.equal(minutosDeLeitura("uma palavra"), 1);
  assert.equal(minutosDeLeitura(""), 1);
  assert.equal(minutosDeLeitura("palavra ".repeat(600)), 3);
});
