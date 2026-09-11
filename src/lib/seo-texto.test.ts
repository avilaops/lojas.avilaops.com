import assert from "node:assert/strict";
import test from "node:test";
import { descricaoDoProduto, resumoParaMeta, textoPuro } from "./seo-texto";

/**
 * Meta description do produto, que faltava em todas as páginas da Brilhax.
 * Mudança compartilhada: vale para todas as lojas, então os casos de borda
 * (HTML, texto curto, palavra gigante) ficam presos aqui.
 */

test("tira HTML e junta espaços", () => {
  assert.equal(textoPuro("<p>Limpador <strong>ácido</strong>\n\n de rodas</p>"), "Limpador ácido de rodas");
});

test("troca entidades comuns", () => {
  assert.equal(textoPuro("Vonixx&nbsp;500ml &amp; 1,5L"), "Vonixx 500ml & 1,5L");
});

test("texto curto passa inteiro, sem reticências", () => {
  assert.equal(resumoParaMeta("Cera de carnaúba para pintura."), "Cera de carnaúba para pintura.");
});

test("texto longo corta em fim de palavra e cabe no limite", () => {
  const longo = "ACIDUS FAST é um limpador ácido automotivo de alta performance, desenvolvido para remover sujeiras pesadas, óxidos e resíduos de rodas, caixas de roda e carrocerias com segurança.";
  const r = resumoParaMeta(longo)!;
  assert.ok(r.length <= 155, `ficou com ${r.length}`);
  assert.ok(r.endsWith("…"));
  assert.ok(!/\s…$/.test(r), "não deixa espaço antes das reticências");
  assert.ok(longo.startsWith(r.slice(0, -1)), "é um prefixo do original, não um texto inventado");
});

test("palavra única enorme corta seco em vez de sumir", () => {
  const r = resumoParaMeta("x".repeat(300))!;
  assert.ok(r.length <= 155 && r.length > 100);
});

test("vazio ou só HTML devolve undefined, e a página herda a descrição da loja", () => {
  assert.equal(resumoParaMeta(""), undefined);
  assert.equal(resumoParaMeta("<p> </p>"), undefined);
  assert.equal(resumoParaMeta(null), undefined);
});

test("a descrição curta do lojista tem prioridade sobre a longa", () => {
  assert.equal(descricaoDoProduto({ descricaoCurta: "Curta.", descricao: "Longa demais." }), "Curta.");
});

test("sem descrição curta, usa a longa resumida", () => {
  assert.equal(descricaoDoProduto({ descricaoCurta: null, descricao: "<p>Longa.</p>" }), "Longa.");
});

test("sem nenhuma das duas, não inventa texto", () => {
  assert.equal(descricaoDoProduto({ descricaoCurta: null, descricao: null }), undefined);
});
