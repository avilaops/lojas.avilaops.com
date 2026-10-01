import assert from "node:assert/strict";
import test from "node:test";
import { detalharErro } from "./erro-de-formulario";

/**
 * Medido no painel rodando: salvar um produto cuja foto tinha endereço
 * inválido respondia 422 com `imagens: ["Invalid url"]`, e a tela dizia
 * apenas "Dados inválidos." — sem dizer que o problema era a foto.
 */
test("o campo recusado aparece junto do título", () => {
  assert.equal(
    detalharErro({ erro: "Dados inválidos.", detalhes: { fieldErrors: { imagens: ["Invalid url"] } } }),
    "Dados inválidos. imagens: Invalid url",
  );
});

test("sem detalhe, fica só o título", () => {
  assert.equal(detalharErro({ erro: "Produto não encontrado." }), "Produto não encontrado.");
  assert.equal(detalharErro({ erro: "Dados inválidos.", detalhes: { fieldErrors: {} } }), "Dados inválidos.");
});

test("resposta vazia ou sem corpo não deixa a tela muda", () => {
  assert.equal(detalharErro(null), "Falha ao salvar.");
  assert.equal(detalharErro(undefined), "Falha ao salvar.");
  assert.equal(detalharErro({}), "Falha ao salvar.");
});

test("muitos campos não viram um parágrafo", () => {
  const r = detalharErro({
    erro: "Dados inválidos.",
    detalhes: { fieldErrors: { a: ["x"], b: ["y"], c: ["z"], d: ["w"], e: ["v"] } },
  });
  assert.equal(r, "Dados inválidos. a: x · b: y · c: z (e mais 2)");
});

test("campo listado sem mensagem não vira rótulo solto", () => {
  assert.equal(
    detalharErro({ erro: "Dados inválidos.", detalhes: { fieldErrors: { imagens: [], gtin: ["Muito curto"] } } }),
    "Dados inválidos. gtin: Muito curto",
  );
});
