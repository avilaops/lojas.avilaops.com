import assert from "node:assert/strict";
import test from "node:test";
import { definicoesVisiveis, provedoresDePagamento } from "./provedores-pagamento";

test("PagBank está registrado e some sem a flag da loja", () => {
  assert.equal(provedoresDePagamento.tem("pagbank"), true);
  assert.equal(provedoresDePagamento.tem("mercadopago"), true);
  assert.deepEqual(
    definicoesVisiveis({ recursos: [] }).map((d) => d.id),
    ["mercadopago"],
  );
  assert.deepEqual(
    definicoesVisiveis({ recursos: ["pagamentos_pagbank"] }).map((d) => d.id),
    ["mercadopago", "pagbank"],
  );
});

test("o botão de pânico esconde o PagBank mesmo com a flag ligada", () => {
  const visiveis = definicoesVisiveis(
    { recursos: ["pagamentos_pagbank"] },
    { LOJAS_RECURSOS_DESLIGADOS: "pagamentos_pagbank" },
  );
  assert.deepEqual(visiveis.map((d) => d.id), ["mercadopago"]);
});
