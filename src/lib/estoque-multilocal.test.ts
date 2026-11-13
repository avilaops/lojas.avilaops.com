import assert from "node:assert/strict";
import { test } from "node:test";
import { ChaveMovimento, MovimentoMultilocal } from "./estoque-multilocal-schema";

const base = { tipo: "entrada", varianteId: "variante-qa", local: "filial-01", quantidade: 1, motivo: "Recebimento QA" };

test("contrato multilocal aceita entrada, saída e transferência imediata", () => {
  for (const tipo of ["entrada", "saida"]) assert.equal(MovimentoMultilocal.safeParse({ ...base, tipo }).success, true);
  assert.equal(MovimentoMultilocal.safeParse({ ...base, tipo: "transferencia", destino: "principal" }).success, true);
});

test("contrato recusa quantidade inválida, local ambíguo, campo desconhecido e mesma origem/destino", () => {
  for (const alteracao of [
    { quantidade: 0 }, { quantidade: -1 }, { quantidade: 1.5 }, { quantidade: 10_000_001 },
    { quantidade: "2" }, { local: "" }, { local: "Filial A" }, { local: "../principal" },
    { motivo: "" }, { tenantId: "outra-loja" }, { tipo: "ajuste" }, { destino: "outro" },
    { tipo: "transferencia" }, { tipo: "transferencia", destino: base.local },
  ]) assert.equal(MovimentoMultilocal.safeParse({ ...base, ...alteracao }).success, false, JSON.stringify(alteracao));
});

test("idempotência exige chave limitada e sem espaços ou quebras de linha", () => {
  assert.equal(ChaveMovimento.safeParse("erp:entrada-123_4.5").success, true);
  for (const chave of ["", "a".repeat(121), " duas", "duas chaves", "linha\nnova"]) {
    assert.equal(ChaveMovimento.safeParse(chave).success, false);
  }
});
