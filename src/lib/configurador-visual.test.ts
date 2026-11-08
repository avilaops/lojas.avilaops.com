import test from "node:test";
import assert from "node:assert/strict";
import { configuracaoParaThermalBoxVisual } from "./configurador-visual";

test("projeta somente os campos visuais do contrato MRG", () => {
  const visual = configuracaoParaThermalBoxVisual({
    dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
    materialExterno: "aco_inoxidavel",
    acabamento: "escovado",
    tampa: "dupla",
    mobilidade: "rodizios",
    divisorias: 10,
    quantidade: 7,
    observacoes: "não usar como espessura industrial",
  });

  assert.deepEqual(visual, {
    dimensionsCm: { width: 80, height: 60, depth: 120 },
    material: "aco_inoxidavel",
    finish: "escovado",
    lid: "dupla",
    mobility: "rodizios",
    dividers: 10,
  });
});
