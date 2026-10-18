import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PUBLICOS = [
  "src/app/plataforma/(site)/page.tsx",
  "src/app/plataforma/(site)/layout.tsx",
  "src/app/plataforma/opengraph-image.tsx",
  "src/app/plataforma/(site)/blog/page.tsx",
];

test("a comunicação pública não promete comissão zero para novos cadastros", () => {
  const texto = PUBLICOS.map((arquivo) => readFileSync(arquivo, "utf8")).join("\n");
  assert.doesNotMatch(texto, /sem comissão|0% de comissão/i);
  assert.match(texto, /5% sobre (as )?vendas/i);
});
