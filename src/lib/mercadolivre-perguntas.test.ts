import assert from "node:assert/strict";
import test from "node:test";
import { LIMITE_RESPOSTA, mapearPergunta, validarResposta } from "./mercadolivre-perguntas";
import { lerAviso } from "./mercadolivre-avisos";

/**
 * Perguntas do Mercado Livre. O que está preso aqui é a validação da resposta:
 * o ML recusa contato e devolve um erro genérico, então quem explica o motivo
 * ao lojista somos nós — antes de gastar a tentativa.
 */

test("resposta vazia ou só espaço não vai", () => {
  assert.equal(validarResposta("").ok, false);
  assert.equal(validarResposta("   \n ").ok, false);
  assert.equal(validarResposta(null).ok, false);
});

test("resposta boa passa, com espaços normalizados", () => {
  const r = validarResposta("  Sim,  temos   em estoque.\nEnviamos hoje. ");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.texto, "Sim, temos em estoque. Enviamos hoje.");
});

test("o limite do Mercado Livre é cobrado antes de enviar", () => {
  const r = validarResposta("a".repeat(LIMITE_RESPOSTA + 1));
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.erro : "", /2000 caracteres/);
  assert.equal(validarResposta("a".repeat(LIMITE_RESPOSTA)).ok, true);
});

test("telefone, e-mail, link e convite para sair do ML são barrados com o motivo", () => {
  const casos: Array<[string, RegExp]> = [
    ["Me chama no (16) 99999-0000", /telefone/],
    ["Manda e-mail para vendas@loja.com.br", /e-mail/],
    ["Veja em https://minhaloja.com/produto", /link/],
    ["Chama no whatsapp que eu explico", /fora do Mercado Livre/],
    ["Segue a gente no @minhalojaoficial", /fora do Mercado Livre/],
  ];
  for (const [texto, motivo] of casos) {
    const r = validarResposta(texto);
    assert.equal(r.ok, false, texto);
    assert.match(r.ok === false ? r.erro : "", motivo, texto);
  }
});

test("resposta comercial legítima não é confundida com contato", () => {
  for (const texto of [
    "Temos 12 unidades. O prazo para São Paulo é de 2 a 3 dias úteis.",
    "Serve sim na CG 160 2019. O código original é 12345-KVS-900.",
    "O frete sai por R$ 24,90 e o produto tem 500ml.",
  ]) {
    assert.equal(validarResposta(texto).ok, true, texto);
  }
});

test("a pergunta do ML vira registro da loja sem inventar contato", () => {
  const p = mapearPergunta({
    id: 12345678,
    text: "Esse produto serve em moto 160?",
    status: "UNANSWERED",
    item_id: "MLB111",
    date_created: "2026-09-17T10:00:00.000-03:00",
    from: { id: 987, nickname: "COMPRADOR99" },
    answer: null,
  });
  assert.equal(p.mlId, "12345678");
  assert.equal(p.mlbId, "MLB111");
  assert.equal(p.autor, "COMPRADOR99");
  assert.equal(p.resposta, null);
  assert.equal(p.perguntadaEm.toISOString(), "2026-09-17T13:00:00.000Z");
});

test("pergunta já respondida no app do ML chega com a resposta e a data", () => {
  const p = mapearPergunta({
    id: 1, item_id: "MLB1", text: "Tem na cor preta?", status: "ANSWERED",
    answer: { text: "Temos sim.", status: "ACTIVE", date_created: "2026-09-17T12:00:00.000Z" },
    from: { id: 5 },
  });
  assert.equal(p.statusMl, "ANSWERED");
  assert.equal(p.resposta, "Temos sim.");
  assert.equal(p.autor, "Comprador 5", "sem apelido, o id é o que há — e não se inventa nome");
  assert.ok(p.respondidaEm instanceof Date);
});

test("o aviso de pergunta é roteado pelo mesmo leitor da fila", () => {
  assert.deepEqual(lerAviso("mercadolivre.questions", { topic: "questions", resource: "/questions/12345678" }), {
    topico: "questions",
    id: "12345678",
  });
});
