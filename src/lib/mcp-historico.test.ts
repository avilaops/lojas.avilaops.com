import { test } from "node:test";
import assert from "node:assert/strict";
import { limiteDaRetencao, RETENCAO_DIAS } from "./mcp-historico";

test("a retenção corta exatamente RETENCAO_DIAS para trás", () => {
  const agora = new Date("2026-10-09T05:00:00Z");
  assert.equal(RETENCAO_DIAS, 90);
  assert.equal(limiteDaRetencao(agora).toISOString(), "2026-07-11T05:00:00.000Z");
});
