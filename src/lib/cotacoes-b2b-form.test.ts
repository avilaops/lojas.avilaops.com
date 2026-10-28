import assert from "node:assert/strict";
import { test } from "node:test";
import { centavosDoFormulario } from "./cotacoes-b2b-form";
import { erroCotacao } from "./cotacoes-b2b-api";
import { ErroCotacaoB2B } from "./cotacoes-b2b-erros";

test("valor do formulário preserva centavos e recusa formatos ambíguos", () => {
  assert.equal(centavosDoFormulario("12,34"), 1234);
  assert.equal(centavosDoFormulario("0.01"), 1);
  assert.equal(centavosDoFormulario(" 12,3 "), 1230);
  assert.equal(centavosDoFormulario(""), undefined);
  assert.equal(centavosDoFormulario("21474836,47"), 2_147_483_647);
  for (const value of ["-1", "1.234", "1.000,00", "1e2", "NaN", "21474836,48"]) assert.throws(() => centavosDoFormulario(value));
});
test("erro inesperado não vaza detalhes e conflito de revisão é acionável", async () => {
  const unknown = erroCotacao(new Error("conexão privada e detalhes internos"));
  assert.equal(unknown.status, 500);
  assert.equal(JSON.stringify(await unknown.json()).includes("detalhes internos"), false);
  const conflict = erroCotacao(new ErroCotacaoB2B("A cotação mudou. Recarregue.", 409));
  assert.equal(conflict.status, 409);
  assert.match((await conflict.json()).erro, /Recarregue/);
});
