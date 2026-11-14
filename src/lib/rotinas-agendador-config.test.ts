import assert from "node:assert/strict";
import { test } from "node:test";
import { configuracaoAgendador } from "./rotinas-agendador-config";
import { NOMES_DE_ROTINA } from "./rotinas";

test("relógio fiscal pode coletar notas com o relógio comercial desligado", () => {
  const fiscal = configuracaoAgendador({ NODE_ENV: "production", ROTINAS_AGENDADOR: "0", FISCAL_AGENDADOR: "1" });
  assert.deepEqual(fiscal, { modo: "FISCAL", nomes: ["fiscal.receber"] });
  assert.ok(!fiscal.nomes.some(nome => nome.startsWith("cobranca.") || nome.startsWith("pix.") || nome.startsWith("automacoes.")));
});

test("relógio conserva o modo geral e exige escolha explícita para fiscal isolado", () => {
  assert.deepEqual(configuracaoAgendador({ NODE_ENV: "production", ROTINAS_AGENDADOR: "0" }), { modo: "DESLIGADO", nomes: [] });
  assert.deepEqual(configuracaoAgendador({ NODE_ENV: "development" }), { modo: "DESLIGADO", nomes: [] });
  assert.deepEqual(configuracaoAgendador({ NODE_ENV: "production", ROTINAS_AGENDADOR: "1", FISCAL_AGENDADOR: "1" }), { modo: "COMPLETO", nomes: NOMES_DE_ROTINA });
  assert.deepEqual(configuracaoAgendador({ NODE_ENV: "production" }), { modo: "COMPLETO", nomes: NOMES_DE_ROTINA });
  assert.equal(configuracaoAgendador({ NODE_ENV: "development", FISCAL_AGENDADOR: "talvez" }).modo, "DESLIGADO");
});
